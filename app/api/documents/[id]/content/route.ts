export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDocumentById, getChunksByDocument } from '@/lib/db/queries';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const docId = params.id;
    const document = await getDocumentById(docId);
    if (!document || !fs.existsSync(document.file_path)) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('raw');

    if (raw === 'true') {
      const fileBuffer = fs.readFileSync(document.file_path);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.file_type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
          'Content-Disposition': `inline; filename="${document.filename}"`,
        },
      });
    }

    const chunks = await getChunksByDocument(docId);
    // Group chunks by page number
    const pagesMap: Record<number, { pageNumber: number; text: string; sectionHeadings: string[] }> = {};

    for (const chunk of chunks) {
      if (!pagesMap[chunk.page_number]) {
        pagesMap[chunk.page_number] = {
          pageNumber: chunk.page_number,
          text: chunk.text,
          sectionHeadings: chunk.section_heading ? [chunk.section_heading] : [],
        };
      } else {
        pagesMap[chunk.page_number].text += '\n\n' + chunk.text;
        if (chunk.section_heading && !pagesMap[chunk.page_number].sectionHeadings.includes(chunk.section_heading)) {
          pagesMap[chunk.page_number].sectionHeadings.push(chunk.section_heading);
        }
      }
    }

    const pages = Object.values(pagesMap).sort((a, b) => a.pageNumber - b.pageNumber);

    return NextResponse.json({
      success: true,
      document,
      pages,
      totalChunks: chunks.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
