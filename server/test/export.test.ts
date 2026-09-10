// server/test/export.test.ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTestApp } from './helpers.js';

const HEADERS = { 'x-admin-key': process.env.ADMIN_KEY ?? 'aepick-admin' };

describe.skipIf(!process.env.SUPABASE_DB_URL)('sessions Excel export', () => {
  it('returns a valid .xlsx with the expected columns', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/admin/export/sessions.xlsx', headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(r.rawPayload);
    const sheet = workbook.getWorksheet('Sessions')!;
    const header = sheet.getRow(1).values as unknown[];
    expect(header).toContain('Full Name');
    expect(header).toContain('Gender');
    expect(header).toContain('Age Group');

    await app.close();
  });
});
