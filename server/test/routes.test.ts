// server/test/routes.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { one } from '../src/db.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('session + profile flow', () => {
  it('creates a session and saves the consent-screen profile fields', async () => {
    const app = buildTestApp();

    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD', language: 'vi' } });
    expect(created.statusCode).toBe(200);
    const { sessionId } = created.json().data as { sessionId: string };
    expect(sessionId).toBeTruthy();

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/profile`,
      payload: { fullName: 'Nguyen Van A', gender: 'male', ageGroup: 'twenties' },
    });
    expect(patched.statusCode).toBe(200);

    const row = await one<{ full_name: string; gender: string; age_group: string }>(
      'select full_name, gender, age_group from sessions where id = $1',
      [sessionId],
    );
    expect(row).toEqual({ full_name: 'Nguyen Van A', gender: 'male', age_group: 'twenties' });

    await app.close();
  });

  it('rejects an invalid gender value', async () => {
    const app = buildTestApp();
    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD', language: 'vi' } });
    const { sessionId } = created.json().data as { sessionId: string };

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/profile`,
      payload: { gender: 'unknown' },
    });
    expect(patched.statusCode).toBe(400);

    await app.close();
  });
});
