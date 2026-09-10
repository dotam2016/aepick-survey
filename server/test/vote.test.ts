import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { seedCatalogIfEmpty } from '../src/catalogSeed.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('voting', () => {
  it('lets a completed visitor vote for 3 products once', async () => {
    await seedCatalogIfEmpty();
    const app = buildTestApp();

    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD-3', language: 'vi' } });
    const { sessionId } = created.json().data as { sessionId: string };
    await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/answers/repick`, payload: { picked: 'B' } });
    const completed = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete` });
    const { resultToken } = completed.json().data as { resultToken: string };

    const options = await app.inject({ method: 'GET', url: `/api/vote/${resultToken}/options` });
    expect(options.statusCode).toBe(200);
    const { brands } = options.json().data as { brands: { products: { id: string }[] }[] };
    const productIds = brands.flatMap((b) => b.products.map((p) => p.id)).slice(0, 3);

    const voted = await app.inject({ method: 'POST', url: `/api/vote/${resultToken}`, payload: { productIds } });
    expect(voted.statusCode).toBe(200);

    const again = await app.inject({ method: 'POST', url: `/api/vote/${resultToken}`, payload: { productIds } });
    expect(again.statusCode).toBe(409);

    await app.close();
  });
});
