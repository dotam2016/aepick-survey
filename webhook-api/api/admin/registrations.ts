import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool } from '../../lib/db.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json(err('method_not_allowed', 'GET only'));

  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json(err('unauthorized', 'invalid admin key'));

  const page = Math.max(1, Number(req.query.page ?? 1));
  const { rows } = await getPool().query(
    `SELECT id, external_id, qr_code, full_name, phone, dob, gender, received_at
     FROM event_registrations ORDER BY received_at DESC LIMIT 50 OFFSET $1`,
    [(page - 1) * 50],
  );
  return res.status(200).json(ok({ registrations: rows, page }));
}
