import { Pool } from 'pg';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Still used by index.ts to serve designer-dropped static assets (logos, product images) — unrelated to the DB. */
export const DATA_DIR = path.resolve(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

/*
 * Lazy on purpose: this module is statically imported by every test file
 * (directly or via test/helpers.ts), including ones that skip their own
 * body with describe.skipIf(!process.env.SUPABASE_DB_URL) when the var is
 * unset. A throw here at import time would crash those files before the
 * skip logic ever runs. Throwing only when a query actually executes keeps
 * "skip cleanly with no SUPABASE_DB_URL" true, while the real server still
 * fails fast in practice — index.ts's first startup action (seeding the
 * catalog) issues a query immediately.
 */
let _pool: Pool | undefined;
function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL is not set. Copy .env.example to .env and paste the connection string from ' +
      'Supabase -> Project Settings -> Database -> Connection string (URI, Transaction pooler).',
    );
  }
  _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  _pool.on('error', (e) => console.error('[db] idle client error', e.message));
  return _pool;
}

export async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}

export async function many<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
  const res = await getPool().query(sql, params);
  return { rowCount: res.rowCount ?? 0 };
}

export const now = () => new Date().toISOString();
export const todayPrefix = () => new Date().toISOString().slice(0, 10);
