import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { seedCatalogIfEmpty } from '../src/catalogSeed.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('catalog', () => {
  it('seeds once and serves the active catalog', async () => {
    await seedCatalogIfEmpty();
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/catalog' });
    expect(r.statusCode).toBe(200);
    const { brands } = r.json().data as { brands: unknown[] };
    expect(brands.length).toBeGreaterThan(0);
    await app.close();
  });
});
