import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function saveUploadedFile(filename: string, buffer: Buffer): { filePath: string; relativePath: string } {
  const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(filePath, buffer);
  return {
    filePath,
    relativePath: `/uploads/${safeName}`,
  };
}
