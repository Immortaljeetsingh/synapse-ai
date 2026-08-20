import * as XLSX from 'xlsx';
import { ParsedDocumentResult, ParsedPage } from './pdf';

export async function parseSpreadsheet(filePath: string): Promise<ParsedDocumentResult> {
  const workbook = XLSX.readFile(filePath);
  const pages: ParsedPage[] = [];
  let pageNum = 1;
  const fullTextParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to json objects for structured analysis
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });
    // Convert to markdown table format
    const csvData = XLSX.utils.sheet_to_csv(worksheet);

    if (jsonData.length === 0) continue;

    const headers = (jsonData[0] as any[]) || [];
    const rowCount = jsonData.length - 1;

    let sheetText = `### Sheet: ${sheetName}\n\n`;
    sheetText += `**Summary**: Sheet contains ${rowCount} rows and ${headers.length} columns: [${headers.join(', ')}]\n\n`;

    // Add markdown representation of rows (up to first 200 rows per sheet to avoid token explosion, but structured)
    const previewRows = jsonData.slice(0, 100);
    if (previewRows.length > 0) {
      sheetText += '#### Data Records:\n';
      const headerRow = previewRows[0] as any[];
      sheetText += `| ${headerRow.join(' | ')} |\n`;
      sheetText += `| ${headerRow.map(() => '---').join(' | ')} |\n`;

      for (let i = 1; i < previewRows.length; i++) {
        const row = (previewRows[i] as any[]) || [];
        const cells = headerRow.map((_, idx) => (row[idx] !== undefined ? String(row[idx]).replace(/\|/g, '\\|') : ''));
        sheetText += `| ${cells.join(' | ')} |\n`;
      }

      if (jsonData.length > 100) {
        sheetText += `\n*(...${jsonData.length - 100} additional rows indexed)*\n`;
      }
    }

    pages.push({
      pageNumber: pageNum++,
      text: sheetText,
      headings: [sheetName, `Columns: ${headers.slice(0, 5).join(', ')}`],
    });

    fullTextParts.push(sheetText);
  }

  const fullText = fullTextParts.join('\n\n---\n\n');

  return {
    pageCount: pages.length || 1,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText || 'Empty Spreadsheet', headings: [] }],
    fullText,
    isScanned: false,
    metadata: { sheets: workbook.SheetNames },
  };
}
