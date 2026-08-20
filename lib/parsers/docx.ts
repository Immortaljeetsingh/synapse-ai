import mammoth from 'mammoth';
import { ParsedDocumentResult, ParsedPage } from './pdf';

export async function parseDocx(filePath: string): Promise<ParsedDocumentResult> {
  const result = await mammoth.extractRawText({ path: filePath });
  const fullText = result.value || '';

  // Approximate page divisions by ~2500 characters or major sections
  const paragraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const pages: ParsedPage[] = [];
  let currentPageText = '';
  let currentPageHeadings: string[] = [];
  let pageNum = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    // Check if paragraph looks like a heading
    if (trimmed.length < 80 && !trimmed.endsWith('.') && (trimmed.startsWith('#') || trimmed.toUpperCase() === trimmed)) {
      currentPageHeadings.push(trimmed.replace(/^#+\s*/, ''));
    }

    if ((currentPageText + '\n\n' + trimmed).length > 2500 && currentPageText.length > 0) {
      pages.push({
        pageNumber: pageNum++,
        text: currentPageText.trim(),
        headings: currentPageHeadings,
      });
      currentPageText = trimmed;
      currentPageHeadings = [];
    } else {
      currentPageText += (currentPageText ? '\n\n' : '') + trimmed;
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
    metadata: { messages: result.messages },
  };
}
