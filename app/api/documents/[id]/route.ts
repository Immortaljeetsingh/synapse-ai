export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDocumentById, deleteDocument, getChunksByDocument, deleteChunksByDocument } from '@/lib/db/queries';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const docId = params.id;
    const document = await getDocumentById(docId);
    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }
    const chunks = await getChunksByDocument(docId);
    return NextResponse.json({ success: true, document, chunks });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const docId = params.id;
    const document = await getDocumentById(docId);
    if (document && fs.existsSync(document.file_path)) {
      try {
        fs.unlinkSync(document.file_path);
      } catch (e) {
        // Ignore file unlink error
      }
    }
    await deleteChunksByDocument(docId);
    await deleteDocument(docId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
