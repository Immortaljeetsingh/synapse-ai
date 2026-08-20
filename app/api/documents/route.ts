export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { saveUploadedFile } from '@/lib/storage';
import { createDocument, getDocumentsByNotebook, insertChunks, createNote } from '@/lib/db/queries';
import { detectFileType, parseDocument } from '@/lib/parsers';
import { chunkDocument } from '@/lib/rag/chunker';
import { computeTextVector } from '@/lib/rag/embeddings';
import { DocumentChunk } from '@/lib/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB limit
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md'];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const notebookId = searchParams.get('notebookId');
    if (!notebookId) {
      return NextResponse.json({ success: false, error: 'notebookId is required' }, { status: 400 });
    }
    const documents = await getDocumentsByNotebook(notebookId);
    return NextResponse.json({ success: true, documents });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const notebookId = formData.get('notebookId') as string;
    const file = formData.get('file') as File;

    if (!notebookId || !file) {
      return NextResponse.json(
        { success: false, error: 'notebookId and file are required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)` },
        { status: 413 }
      );
    }

    const rawFilename = path.basename(file.name || 'document.pdf');
    const ext = path.extname(rawFilename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type "${ext}". Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD.`,
        },
        { status: 415 }
      );
    }

    const fileType = detectFileType(rawFilename);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Uploaded file is empty (0 bytes).' },
        { status: 400 }
      );
    }

    // Calculate content hash for caching
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Save to secure uploads folder
    const { filePath } = saveUploadedFile(rawFilename, buffer);

    // 2. Immediate in-lambda parsing & vector chunking (atomic, sub-second)
    const parsed = await parseDocument(filePath, rawFilename);
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const rawChunks = chunkDocument(parsed, docId, notebookId, rawFilename, {
      targetChunkSize: 900,
      overlapSize: 120,
    });

    const processedChunks: DocumentChunk[] = rawChunks.map((chunk) => ({
      ...chunk,
      embedding_json: JSON.stringify(computeTextVector(chunk.text + ' ' + chunk.section_heading)),
    }));

    // 3. Create document record with status 'ready'
    const document = await createDocument({
      id: docId,
      notebook_id: notebookId,
      filename: rawFilename,
      file_type: fileType,
      file_size: file.size,
      page_count: parsed.pageCount || 1,
      file_path: filePath,
      content_hash: contentHash,
      processing_status: 'ready',
      is_scanned: parsed.isScanned,
    });

    // 4. Save chunks in database
    await insertChunks(processedChunks);

    // 5. Create initial study overview note
    const noteId = `note_init_${docId}_${Date.now()}`;
    await createNote({
      id: noteId,
      notebook_id: notebookId,
      title: `📌 Overview: ${rawFilename}`,
      content: `### Document Overview: ${rawFilename}\n\n**Total Pages:** ${parsed.pageCount}\n**Total Chunks:** ${processedChunks.length}\n\n#### Key Sections Detected:\n${processedChunks.slice(0, 5).map((c) => `- **${c.section_heading || 'Section'}**: ${c.text.slice(0, 140)}...`).join('\n')}\n\n---\n*Ready for grounded Q&A, active-recall study flashcards, and practice quiz generation.*`,
      format_type: 'cornell',
    });

    // 6. Return lightweight chunks without heavy embedding vectors (drops payload from 10MB to 15KB)
    const lightweightChunks = processedChunks.map((c) => ({
      id: c.id,
      document_id: docId,
      notebook_id: notebookId,
      chunk_index: c.chunk_index,
      page_number: c.page_number,
      section_heading: c.section_heading,
      text: c.text,
      filename: rawFilename,
    }));

    return NextResponse.json({
      success: true,
      document: {
        ...document,
        chunks: lightweightChunks,
      },
      chunkCount: processedChunks.length,
      pageCount: parsed.pageCount,
    });
  } catch (err: any) {
    console.error('Error uploading and indexing file:', err);
    return NextResponse.json({ success: false, error: 'File upload and indexing failed. Please try again.' }, { status: 500 });
  }
}
