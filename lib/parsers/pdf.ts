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

  // Tier 1: Page-by-page structured extraction.
  // pdf-parse's per-page hook is `pagerender` (NOT `pager`) — verified against
  // node_modules/pdf-parse/lib/pdf-parse.js. Using the wrong key silently
  // disables page tracking and collapses every PDF to a single "page 1".
  try {
    const data = await (pdfParse as any)(dataBuffer, { pagerender: pager });
    const totalPages = data.numpages || pages.length || 1;
    const fullText = data.text || pages.map((p) => p.text).join('\n\n');
    const trimmedFullText = fullText.trim();
    const isScanned = trimmedFullText.length < 50 * totalPages || trimmedFullText.length < 50;

    return {
      pageCount: totalPages,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText, headings: [] }],
      fullText,
      isScanned,
      metadata: data.info || {},
    };
  } catch (err1) {
    // Tier 2: Standard pdf-parse without custom pager
    try {
      const data = await (pdfParse as any)(dataBuffer);
      const totalPages = data.numpages || 1;
      const fullText = data.text || '';
      return {
        pageCount: totalPages,
        pages: [{ pageNumber: 1, text: fullText, headings: [] }],
        fullText,
        isScanned: fullText.trim().length < 50,
        metadata: data.info || {},
      };
    } catch (err2) {
      // Tier 3: Robust stream/binary fallback (for malformed XRef or corrupt PDF streams)
      const rawString = dataBuffer.toString('latin1');
      const textMatches: string[] = [];
      const streamRegex = /\(([^)\\]{3,})\)/g;
      let m;
      while ((m = streamRegex.exec(rawString)) !== null) {
        textMatches.push(m[1]);
      }
      const fallbackText = textMatches.join(' ') || rawString.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();

      return {
        pageCount: 1,
        pages: [{ pageNumber: 1, text: fallbackText, headings: [] }],
        fullText: fallbackText,
        isScanned: false,
        metadata: {},
      };
    }
  }
}
