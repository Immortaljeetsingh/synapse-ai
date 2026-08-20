import { ParsedDocumentResult, ParsedPage } from '../parsers';
import { DocumentChunk } from '../types';

export interface ChunkOptions {
  targetChunkSize?: number; // Target characters per chunk (~800-1200 chars)
  overlapSize?: number; // Overlap characters (~150 chars)
}

export function chunkDocument(
  parsed: ParsedDocumentResult,
  documentId: string,
  notebookId: string,
  filename: string,
  options: ChunkOptions = {}
): DocumentChunk[] {
  const targetSize = options.targetChunkSize || 900;
  const overlapSize = options.overlapSize || 120;
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const page of parsed.pages) {
    const pageNum = page.pageNumber;
    const pageText = page.text;

    if (!pageText || pageText.trim().length === 0) continue;

    // Split page text into structural paragraphs / blocks
    const paragraphs = pageText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    let currentSectionHeading = page.headings.length > 0 ? page.headings[0] : '';
    let currentChunkText = '';
    let paragraphPos = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];

      // Check if this paragraph is a section heading
      if (para.length < 90 && !para.endsWith('.') && (para.startsWith('#') || para.toUpperCase() === para)) {
        currentSectionHeading = para.replace(/^#+\s*/, '');
      }

      // Check if adding this paragraph exceeds target size
      if (currentChunkText.length > 0 && (currentChunkText.length + para.length) > targetSize) {
        // Save current chunk
        const chunkId = `chk_${documentId}_${chunkIndex}`;
        chunks.push({
          id: chunkId,
          document_id: documentId,
          notebook_id: notebookId,
          chunk_index: chunkIndex++,
          page_number: pageNum,
          section_heading: currentSectionHeading,
          paragraph_position: paragraphPos,
          text: currentChunkText.trim(),
          metadata_json: JSON.stringify({
            filename,
            page_number: pageNum,
            section_heading: currentSectionHeading,
            char_count: currentChunkText.length,
          }),
        });

        // Carry over overlap text if suitable
        const words = currentChunkText.split(/\s+/);
        const overlapWords = words.slice(Math.max(0, words.length - 25)).join(' ');
        currentChunkText = overlapWords + '\n\n' + para;
        paragraphPos = i;
      } else {
        currentChunkText = (currentChunkText ? currentChunkText + '\n\n' : '') + para;
      }
    }

    // Flush any remaining text on this page
    if (currentChunkText.trim().length > 0) {
      const chunkId = `chk_${documentId}_${chunkIndex}`;
      chunks.push({
        id: chunkId,
        document_id: documentId,
        notebook_id: notebookId,
        chunk_index: chunkIndex++,
        page_number: pageNum,
        section_heading: currentSectionHeading,
        paragraph_position: paragraphPos,
        text: currentChunkText.trim(),
        metadata_json: JSON.stringify({
          filename,
          page_number: pageNum,
          section_heading: currentSectionHeading,
          char_count: currentChunkText.length,
        }),
      });
    }
  }

  // Fallback if no chunks generated
  if (chunks.length === 0 && parsed.fullText.trim().length > 0) {
    chunks.push({
      id: `chk_${documentId}_0`,
      document_id: documentId,
      notebook_id: notebookId,
      chunk_index: 0,
      page_number: 1,
      section_heading: 'Overview',
      paragraph_position: 0,
      text: parsed.fullText.slice(0, targetSize * 2).trim(),
      metadata_json: JSON.stringify({ filename, page_number: 1, section_heading: 'Overview' }),
    });
  }

  return chunks;
}
