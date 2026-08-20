export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { saveUploadedFile } from '@/lib/storage';
import { createDocument, getDocumentsByNotebook } from '@/lib/db/queries';
import { detectFileType } from '@/lib/parsers';

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

    // Save to secure uploads folder
    const { filePath } = saveUploadedFile(rawFilename, buffer);

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const document = await createDocument({
      id: docId,
      notebook_id: notebookId,
      filename: rawFilename,
      file_type: fileType,
      file_size: file.size,
      page_count: 1,
      file_path: filePath,
      content_hash: contentHash,
      processing_status: 'uploading',
    });

    return NextResponse.json({ success: true, document });
  } catch (err: any) {
    console.error('Error uploading file:', err);
    return NextResponse.json({ success: false, error: 'File upload failed. Please try again.' }, { status: 500 });
  }
}
