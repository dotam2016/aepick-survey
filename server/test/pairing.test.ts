// server/test/pairing.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('pairing flow', () => {
  it('issues a code, claims it, and the PAD sees it claimed', async () => {
    const app = buildTestApp();

    const issued = await app.inject({ method: 'POST', url: '/api/pairings', payload: { deviceId: 'TEST-PAD-2' } });
    expect(issued.statusCode).toBe(200);
    const { code } = issued.json().data as { code: string };

    const claimed = await app.inject({
      method: 'POST',
      url: `/api/pairings/${code}/claim`,
      payload: { credential: 'test-user-1', language: 'vi' },
    });
    expect(claimed.statusCode).toBe(200);
    expect(claimed.json().data.sessionId).toBeTruthy();

    const polled = await app.inject({ method: 'GET', url: `/api/pairings/${code}` });
    expect(polled.json().data.status).toBe('claimed');

    await app.close();
  });
});
