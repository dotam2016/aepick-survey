// server/test/admin.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';

const HEADERS = { 'x-admin-key': process.env.ADMIN_KEY ?? 'aepick-admin' };

describe.skipIf(!process.env.SUPABASE_DB_URL)('admin dashboard', () => {
  it('rejects without the admin key', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/admin/overview' });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('returns overview, analytics, and sessions (with profile fields) for the admin key', async () => {
    const app = buildTestApp();

    const overview = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: HEADERS });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data.today).toHaveProperty('started');

    const analytics = await app.inject({ method: 'GET', url: '/api/admin/analytics', headers: HEADERS });
    expect(analytics.statusCode).toBe(200);

    const sessions = await app.inject({ method: 'GET', url: '/api/admin/sessions', headers: HEADERS });
    expect(sessions.statusCode).toBe(200);
    const rows = sessions.json().data.sessions as Record<string, unknown>[];
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('full_name');
      expect(rows[0]).toHaveProperty('gender');
      expect(rows[0]).toHaveProperty('age_group');
    }

    await app.close();
  });
});
