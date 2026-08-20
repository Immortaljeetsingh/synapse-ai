import path from 'path';
import fs from 'fs';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NEXT_RUNTIME === 'nodejs');
const UPLOAD_DIR = isServerless ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create UPLOAD_DIR:', e);
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}

export function saveUploadedFile(filename: string, buffer: Buffer): { filePath: string; relativePath: string } {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch {}

  const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.error('Error writing file to disk:', err);
  }
  return {
    filePath,
    relativePath: `/uploads/${safeName}`,
  };
}
