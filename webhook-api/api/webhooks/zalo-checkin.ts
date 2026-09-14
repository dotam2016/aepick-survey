import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, now } from '../../lib/db.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

function firstString(body: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/*
 * Called by the Zalo mini-app/QR team right after a visitor submits the
 * check-in form. We don't control their payload shape, so common field-name
 * aliases are accepted and the raw body is always kept too — nothing is
 * lost even if the guessed names are wrong. Same logic as
 * server/src/webhookRoutes.ts (the on-site kiosk copy); kept here as a
 * standalone Vercel function so it has a stable always-on URL independent
 * of the kiosk PC. Adjust aliases once Zalo shares a real payload sample.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json(err('method_not_allowed', 'POST only'));

  const secret = process.env.ZALO_WEBHOOK_SECRET;
  if (!secret || req.headers['x-webhook-secret'] !== secret)
    return res.status(401).json(err('unauthorized', 'invalid webhook secret'));

  const body = (req.body ?? {}) as Record<string, unknown>;
  if (Object.keys(body).length === 0) return res.status(400).json(err('bad_request', 'empty body'));

  const externalId = firstString(body, ['registrationId', 'id', 'eventId']);
  const qrCode = firstString(body, ['qrCode', 'qrId', 'code']);
  const fullName = firstString(body, ['fullName', 'name', 'zaloName']);
  const phone = firstString(body, ['phone', 'phoneNumber', 'tel']);
  const dob = firstString(body, ['dob', 'birthday', 'dateOfBirth']);
  const gender = firstString(body, ['gender', 'sex']);

  await getPool().query(
    `INSERT INTO event_registrations (external_id, qr_code, full_name, phone, dob, gender, raw_payload, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (external_id) WHERE external_id IS NOT NULL
     DO UPDATE SET qr_code=excluded.qr_code, full_name=excluded.full_name, phone=excluded.phone,
       dob=excluded.dob, gender=excluded.gender, raw_payload=excluded.raw_payload, received_at=excluded.received_at`,
    [externalId, qrCode, fullName, phone, dob, gender, JSON.stringify(body), now()],
  );

  return res.status(200).json(ok({ stored: true }));
}
