import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { DB_SCHEMA } from './schema';

// Only treat as ephemeral/serverless when actually deployed there.
// NEXT_RUNTIME === 'nodejs' is also true in local dev, so it must NOT be used here.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const DB_DIR = process.env.DB_PATH
  ? path.dirname(path.resolve(process.env.DB_PATH))
  : isServerless
    ? path.join('/tmp', 'data')
    : path.join(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DB_DIR, 'app.db');

try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  // Gracefully handle read-only environments
}

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;
let sqlPromise: Promise<any> | null = null;
let wasmBinaryBuffer: ArrayBuffer | null = null;

async function getSqlJs() {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      // Check multiple candidate local paths
      const candidates = [
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(process.cwd(), '.next', 'server', 'chunks', 'sql-wasm.wasm'),
        path.join(__dirname, 'sql-wasm.wasm'),
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            const buf = fs.readFileSync(p);
            const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            return await initSqlJs({ wasmBinary: arrayBuf });
          } catch {}
        }
      }

      // Fetch wasm remotely into buffer for Vercel / serverless environments
      if (!wasmBinaryBuffer) {
        const wasmRes = await fetch('https://sql.js.org/dist/sql-wasm.wasm');
        wasmBinaryBuffer = await wasmRes.arrayBuffer();
      }

      return initSqlJs({
        wasmBinary: wasmBinaryBuffer,
      });
    })();
  }
  return sqlPromise;
}

export async function getDb(): Promise<Database> {
  // Memoize the init PROMISE, not just the result — otherwise concurrent
  // callers each start their own init and race on the same file.
  dbInitPromise ??= (async () => {
    const SQL = await getSqlJs();
    let db: Database;
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
      } else {
        db = new SQL.Database();
      }
    } catch (err) {
      // Existing DB is corrupt — quarantine it for inspection instead of
      // silently overwriting user data with a fresh empty database.
      console.error(`[db] FAILED to load existing database at ${DB_PATH} — quarantining and recreating. Error:`, err);
      try {
        fs.renameSync(DB_PATH, `${DB_PATH}.corrupt-${Date.now()}`);
      } catch (renameErr) {
        console.error('[db] Could not quarantine corrupt database file:', renameErr);
      }
      db = new SQL.Database();
    }

    // Execute schema (CREATE TABLE IF NOT EXISTS ...)
    try {
      db.run(DB_SCHEMA);
    } catch (err) {
      console.error('Error running DB_SCHEMA:', err);
    }

    try {
      db.run(`ALTER TABLE chat_messages ADD COLUMN special_payload_json TEXT;`);
    } catch {}

    // Unique-index migrations: idempotent via IF NOT EXISTS, but duplicates in
    // legacy data make creation throw — catch + log so one failure doesn't
    // block the rest of startup.
    const uniqueIndexMigrations: Array<[string, string]> = [
      ['idx_topic_perf_unique', `CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_perf_unique ON quiz_topic_performance(notebook_id, topic);`],
      ['idx_artifact_unique', `CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_unique ON generated_artifacts(notebook_id, artifact_type, COALESCE(document_id, ''));`],
    ];
    for (const [name, ddl] of uniqueIndexMigrations) {
      try {
        db.run(ddl);
      } catch (err) {
        console.error(`[db] Migration ${name} failed (likely duplicate rows in legacy data):`, err);
      }
    }

    // Pragmas must run as standalone statements AFTER the schema. Run and verify:
    // if enforcement cannot be enabled we log loudly, because queries.ts relies on it.
    try {
      db.run(`PRAGMA foreign_keys = ON;`);
      const fk = db.exec('PRAGMA foreign_keys;');
      const enabled = fk[0]?.values?.[0]?.[0] === 1;
      if (!enabled) {
        console.warn('[db] PRAGMA foreign_keys could not be enabled — relying on explicit cascade deletes.');
      }
    } catch (err) {
      console.error('[db] Failed to set PRAGMA foreign_keys:', err);
    }

    dbInstance = db;
    saveDb();
    return dbInstance;
  })();
  return dbInitPromise;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    // Keep not-throwing (in-memory db still works), but log so data loss is diagnosable.
    console.error(`[db] saveDb() failed to persist database to ${DB_PATH}:`, err);
  }
}
