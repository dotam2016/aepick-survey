import { describe, it, expect } from 'vitest';
import { one } from '../src/db.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('db connectivity', () => {
  it('can query Postgres through the pool', async () => {
    const row = await one<{ ok: number }>('select 1 as ok');
    expect(row?.ok).toBe(1);
  });
});
