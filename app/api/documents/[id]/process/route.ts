export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import {
  getDocumentById,
  updateDocumentStatus,
  insertChunks,
  deleteChunksByDocument,
  createNote,
  saveArtifact,
} from '@/lib/db/queries';
import { parseDocument } from '@/lib/parsers';
import { chunkDocument } from '@/lib/rag/chunker';
import { computeTextVector } from '@/lib/rag/embeddings';
import { DocumentChunk } from '@/lib/types';
import { getAIProvider, PROMPTS } from '@/lib/ai';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const docId = params.id;
  const doc = await getDocumentById(docId);

  if (!doc) {
    return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
  }

  try {
    await updateDocumentStatus(docId, 'processing');

    // 1. Parse document text & page boundaries
    const parsed = await parseDocument(doc.file_path, doc.filename);

    // 2. Chunk text semantically and structurally
    const rawChunks = chunkDocument(parsed, doc.id, doc.notebook_id, doc.filename, {
      targetChunkSize: 900,
      overlapSize: 120,
    });

    // 3. Compute vector embeddings for retrieval
    const processedChunks: DocumentChunk[] = rawChunks.map((chunk) => {
      const vector = computeTextVector(chunk.text + ' ' + chunk.section_heading);
      return {
        ...chunk,
        embedding_json: JSON.stringify(vector),
      };
    });

    // 4. Save chunks in database
    await deleteChunksByDocument(docId);
    await insertChunks(processedChunks);

    // 5. Update document status to ready
    await updateDocumentStatus(docId, 'ready', {
      page_count: parsed.pageCount,
      is_scanned: parsed.isScanned,
    });

    // 6. Generate lightweight initial study note asynchronously / safely
    const fullText = parsed.fullText || processedChunks.map((c) => c.text).join('\n\n');
    if (fullText.trim().length > 30) {
      try {
        const apiKeyHeader = req.headers.get('x-api-key') || undefined;
        const providerHeader = req.headers.get('x-provider') || undefined;
        const modelHeader = req.headers.get('x-model') || undefined;
        const baseUrlHeader = req.headers.get('x-base-url') || undefined;

        const ai = await getAIProvider({
          apiKey: apiKeyHeader,
          provider: providerHeader,
          model: modelHeader,
          baseUrl: baseUrlHeader,
        });

        // Create standard initial note
        const noteId = `note_auto_${doc.id}_${Date.now()}`;
        const summarySnippet = fullText.slice(0, 1500);
        await createNote({
          id: noteId,
          notebook_id: doc.notebook_id,
          title: `📌 Overview: ${doc.filename}`,
          content: `### Document Overview: ${doc.filename}\n\n**Total Pages:** ${parsed.pageCount}\n**Total Chunks:** ${processedChunks.length}\n\n#### Key Sections Detected:\n${processedChunks.slice(0, 5).map((c) => `- **${c.section_heading || 'Section'}**: ${c.text.slice(0, 120)}...`).join('\n')}\n\n---\n*Ready for grounded Q&A, active-recall study flashcards, and practice quiz generation.*`,
          format_type: 'cornell',
        });
      } catch (e) {
        // Non-blocking note generation fallback
      }
    }

    return NextResponse.json({
      success: true,
      documentId: docId,
      pageCount: parsed.pageCount,
      chunkCount: processedChunks.length,
      status: 'ready',
    });
  } catch (err: any) {
    console.error('Error processing document:', err);
    await updateDocumentStatus(docId, 'error', { error_message: err.message });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
