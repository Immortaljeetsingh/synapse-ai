export const dynamic = 'force-dynamic';
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

    // 6. Deep AI Intelligence: Generate Notes & Overview with High Attention to Detail
    const fullText = parsed.fullText || processedChunks.map((c) => c.text).join('\n\n');

    if (fullText.trim().length > 30) {
      try {
        const ai = await getAIProvider();

        // A. Generate 3 Comprehensive Deep Notes (Study Notes, Deep Analysis, Quality & Error Audit)
        const notesPrompt = PROMPTS.DOCUMENT_DEEP_NOTES_AND_AUDIT(doc.filename, fullText.slice(0, 25000));
        const notesRes = await ai.generateStructuredJson<{
          notes: Array<{ title: string; format_type?: string; content?: string; points?: string[] }>;
        }>([
          { role: 'system', content: notesPrompt.system },
          { role: 'user', content: notesPrompt.user },
        ]);

        if (notesRes.notes && Array.isArray(notesRes.notes)) {
          for (let i = 0; i < notesRes.notes.length; i++) {
            const n = notesRes.notes[i];
            let contentStr = '';
            if (typeof n.content === 'string' && n.content.trim().length > 0) {
              contentStr = n.content;
            } else if (Array.isArray(n.points) && n.points.length > 0) {
              contentStr = n.points.map((p) => `* ${p}`).join('\n\n');
            } else {
              contentStr = JSON.stringify(n, null, 2);
            }

            const noteId = `note_auto_${doc.id}_${i}_${Date.now()}`;
            await createNote({
              id: noteId,
              notebook_id: doc.notebook_id,
              title: n.title || (i === 0 ? `📌 Executive Study Notes: ${doc.filename}` : i === 1 ? `🔍 Deep Analysis & Critical Takeaways: ${doc.filename}` : `⚠️ Quality, Gaps & Discrepancy Audit: ${doc.filename}`),
              content: contentStr,
              format_type: n.format_type || (i === 0 ? 'cornell' : i === 1 ? 'bullet' : 'exam'),
              is_pinned: i === 0 ? 1 : 0, // Pin the primary executive study notes
            });
          }
        }

        // B. Generate Overview & Key Takeaways Artifact
        const overviewPrompt = PROMPTS.DOCUMENT_OVERVIEW(doc.filename, fullText.slice(0, 25000));
        const overviewRes = await ai.generateStructuredJson<any>([
          { role: 'system', content: overviewPrompt.system },
          { role: 'user', content: overviewPrompt.user },
        ]);

        if (overviewRes) {
          await saveArtifact(
            `art_ov_${doc.id}_${Date.now()}`,
            doc.notebook_id,
            doc.id,
            'overview',
            JSON.stringify(overviewRes)
          );
          await saveArtifact(
            `art_ov_nb_${doc.notebook_id}_${Date.now()}`,
            doc.notebook_id,
            null,
            'overview',
            JSON.stringify(overviewRes)
          );
        }

        // C. Generate Topics & Concepts Taxonomy
        const topicsPrompt = PROMPTS.TOPICS_EXTRACTION(fullText.slice(0, 25000));
        const topicsRes = await ai.generateStructuredJson<{ topics: any[] }>([
          { role: 'system', content: topicsPrompt.system },
          { role: 'user', content: topicsPrompt.user },
        ]);

        if (topicsRes?.topics) {
          await saveArtifact(
            `art_top_${doc.id}_${Date.now()}`,
            doc.notebook_id,
            doc.id,
            'topics',
            JSON.stringify(topicsRes.topics)
          );
          await saveArtifact(
            `art_top_nb_${doc.notebook_id}_${Date.now()}`,
            doc.notebook_id,
            null,
            'topics',
            JSON.stringify(topicsRes.topics)
          );
        }
      } catch (aiErr: any) {
        console.warn(`Auto-intelligence extraction for ${doc.filename} completed with warning:`, aiErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document parsed, indexed, and deep notes generated successfully.',
      pageCount: parsed.pageCount,
      chunkCount: processedChunks.length,
      isScanned: parsed.isScanned,
    });
  } catch (err: any) {
    console.error(`Error indexing document ${docId}:`, err);
    await updateDocumentStatus(docId, 'error', { error_message: err.message });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
