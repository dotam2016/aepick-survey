// server/test/webhook.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';

const SECRET = process.env.ZALO_WEBHOOK_SECRET ?? 'aepick-webhook-dev';

describe.skipIf(!process.env.SUPABASE_DB_URL)('zalo check-in webhook', () => {
  it('rejects without the correct secret', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'POST', url: '/api/webhooks/zalo-checkin', payload: { name: 'Test' } });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('stores a registration and surfaces it via admin', async () => {
    const app = buildTestApp();
    const externalId = `test-${Date.now()}`;
    const post = await app.inject({
      method: 'POST',
      url: '/api/webhooks/zalo-checkin',
      headers: { 'x-webhook-secret': SECRET },
      payload: { registrationId: externalId, name: 'Nguyen Van A', phone: '0900000000', gender: 'male' },
    });
    expect(post.statusCode).toBe(200);

    const admin = await app.inject({
      method: 'GET',
      url: '/api/admin/registrations',
      headers: { 'x-admin-key': process.env.ADMIN_KEY ?? 'aepick-admin' },
    });
    expect(admin.statusCode).toBe(200);
    const rows = admin.json().data.registrations as Record<string, unknown>[];
    expect(rows.some((r) => r.external_id === externalId)).toBe(true);

    await app.close();
  });
});
