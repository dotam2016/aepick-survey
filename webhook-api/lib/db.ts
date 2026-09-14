import { Pool } from 'pg';

/*
 * Module-level singleton so a warm Vercel function invocation reuses the
 * same pool instead of opening a fresh one per request — same reasoning as
 * server/src/db.ts, required to not exhaust Supabase's connection pooler.
 */
let _pool: Pool | undefined;

export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL is not set (add it in Vercel project settings)');
  _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return _pool;
}

export const now = () => new Date().toISOString();
