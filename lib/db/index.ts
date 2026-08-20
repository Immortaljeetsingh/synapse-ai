import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { DB_SCHEMA } from './schema';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NEXT_RUNTIME === 'nodejs');
const DB_DIR = isServerless ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');

try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create DB_DIR, using in-memory SQLite:', e);
}

let dbInstance: Database | null = null;
let sqlPromise: Promise<any> | null = null;

async function getSqlJs() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => {
        // In local development, try local path first
        const localWasm = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(localWasm)) {
          return localWasm;
        }
        // Fallback for Vercel / serverless cloud environments
        return `https://sql.js.org/dist/${file}`;
      },
    });
  }
  return sqlPromise;
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await getSqlJs();
  let db: Database;
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }

  // Execute schema
  try {
    db.run(DB_SCHEMA);
  } catch (err) {
    console.error('Error running DB_SCHEMA:', err);
  }

  try {
    db.run(`ALTER TABLE chat_messages ADD COLUMN special_payload_json TEXT;`);
  } catch {}

  dbInstance = db;
  saveDb();
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    // In serverless environments, writing to disk may fail or be ephemeral; in-memory db continues to work
  }
}
