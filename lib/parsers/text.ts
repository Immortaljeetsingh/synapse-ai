import fs from 'fs';
import { ParsedDocumentResult, ParsedPage } from './pdf';

export async function parseTextFile(filePath: string): Promise<ParsedDocumentResult> {
  const fullText = fs.readFileSync(filePath, 'utf-8');
  const lines = fullText.split('\n');

  const pages: ParsedPage[] = [];
  let currentPageText = '';
  let currentPageHeadings: string[] = [];
  let pageNum = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || (trimmed.length < 80 && trimmed.toUpperCase() === trimmed && trimmed.length > 3)) {
      currentPageHeadings.push(trimmed.replace(/^#+\s*/, ''));
    }

    if ((currentPageText + '\n' + line).length > 2500 && currentPageText.length > 0) {
      pages.push({
        pageNumber: pageNum++,
        text: currentPageText.trim(),
        headings: currentPageHeadings,
      });
      currentPageText = line;
      currentPageHeadings = [];
    } else {
      currentPageText += (currentPageText ? '\n' : '') + line;
    }
  }

  if (currentPageText.trim().length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: pageNum,
      text: currentPageText.trim(),
      headings: currentPageHeadings,
    });
  }

  return {
    pageCount: pages.length,
    pages,
    fullText,
    isScanned: fullText.trim().length === 0,
    metadata: { lineCount: lines.length },
  };
}
