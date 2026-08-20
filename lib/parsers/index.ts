import path from 'path';
import { parsePdf, ParsedDocumentResult } from './pdf';
import { parseDocx } from './docx';
import { parseSpreadsheet } from './spreadsheet';
import { parseTextFile } from './text';
import { FileType } from '../types';

export function detectFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'csv':
      return 'csv';
    case 'md':
      return 'md';
    case 'txt':
      return 'txt';
    default:
      return 'other';
  }
}

export async function parseDocument(filePath: string, filename: string): Promise<ParsedDocumentResult> {
  const fileType = detectFileType(filename);

  switch (fileType) {
    case 'pdf':
      return await parsePdf(filePath);
    case 'docx':
      return await parseDocx(filePath);
    case 'xlsx':
    case 'csv':
      return await parseSpreadsheet(filePath);
    case 'txt':
    case 'md':
      return await parseTextFile(filePath);
    default:
      // Fallback to text parsing
      try {
        return await parseTextFile(filePath);
      } catch {
        throw new Error(`Unsupported document format: ${path.extname(filename)}`);
      }
  }
}

export type { ParsedDocumentResult, ParsedPage } from './pdf';
