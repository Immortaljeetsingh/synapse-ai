import fs from 'fs';
import pdfParse from 'pdf-parse';

export interface ParsedPage {
  pageNumber: number;
  text: string;
  headings: string[];
}

export interface ParsedDocumentResult {
  pageCount: number;
  pages: ParsedPage[];
  fullText: string;
  isScanned: boolean;
  metadata: Record<string, any>;
}

export async function parsePdf(filePath: string): Promise<ParsedDocumentResult> {
  const dataBuffer = fs.readFileSync(filePath);
  const pages: ParsedPage[] = [];
  let currentPageIndex = 0;

  function pager(pageData: any) {
    currentPageIndex++;
    return pageData.getTextContent().then((textContent: any) => {
      let lastY: number | null = null;
      let text = '';
      const headings: string[] = [];

      for (const item of textContent.items) {
        if (lastY == null || Math.abs(item.transform[5] - lastY) > 5) {
          text += '\n' + item.str;
        } else {
          text += (text.endsWith(' ') ? '' : ' ') + item.str;
        }
        lastY = item.transform[5];

        if (item.height > 12 && item.str.trim().length > 3 && item.str.trim().length < 80) {
          headings.push(item.str.trim());
        }
      }

      pages.push({
        pageNumber: currentPageIndex,
        text: text.trim(),
        headings,
      });

      return text;
    });
  }

  try {
    const data = await (pdfParse as any)(dataBuffer, { pager });
    const totalPages = data.numpages || pages.length || 1;
    const fullText = data.text || pages.map((p) => p.text).join('\n\n');

    const trimmedFullText = fullText.trim();
    const isScanned = trimmedFullText.length < 50 * totalPages || trimmedFullText.length < 50;

    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        text: fullText,
        headings: [],
      });
    }

    return {
      pageCount: totalPages,
      pages,
      fullText,
      isScanned,
      metadata: data.info || {},
    };
  } catch (err: any) {
    console.error('Error parsing PDF with pdf-parse:', err);
    throw new Error(`Failed to parse PDF document: ${err.message}`);
  }
}
