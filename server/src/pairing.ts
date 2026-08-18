import { randomBytes, randomUUID } from 'node:crypto';
import { db, now } from './db.js';
import { visitorIdOf, type AppIdentity } from './identity.js';

/**
 * ────────────────────────────────────────────────────────────────
 *  세션 페어링
 * ────────────────────────────────────────────────────────────────
 *
 * 고객은 PAD 화면의 QR을 찍어 자신의 app 계정을 이 PAD의 체험에 연결한다.
 *
 *   PAD    : 대기화면에서 일회용 코드 발급 → QR 표시 → 클레임될 때까지 폴링
 *   폰     : QR 스캔 → app 계정 확인 → 클레임
 *   서버   : 클레임 시 세션 생성 + 방문 횟수 증가 + 코드 소각
 *
 * PAD가 10대 규모로 동시에 돌기 때문에 아래 두 가지가 설계의 핵심이다.
 *
 *  1) 코드는 기기마다 따로 발급된다.
 *     고정 QR을 쓰면 두 사람이 비슷한 시각에 찍었을 때
 *     누가 어느 PAD의 체험자인지 서버가 판단할 수 없다.
 *
 *  2) 클레임은 원자적이다.
 *     UPDATE ... WHERE status='pending' 의 변경 행 수로 승자를 가린다.
 *     같은 코드를 두 명이 동시에 찍어도 한 명만 성공한다.
 */

/** 코드 유효 시간. 지나면 PAD가 새 코드를 발급한다. */
export const PAIRING_TTL_MS = 3 * 60 * 1000;

export type PairingStatus = 'pending' | 'claimed' | 'expired';

export interface PairingRow {
  code: string;
  device_id: string;
  status: PairingStatus;
  visitor_id: string | null;
  session_id: string | null;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
}

const newCode = () => randomBytes(9).toString('base64url'); // 12자

/**
 * PAD가 대기화면에서 호출한다.
 * 같은 기기에 떠 있던 이전 pending 코드는 무효화해 QR이 하나만 유효하게 둔다.
 */
export function issuePairing(deviceId: string): PairingRow {
  const ts = now();
  db.prepare(`UPDATE pairings SET status='expired' WHERE device_id=? AND status='pending'`).run(deviceId);

  const code = newCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  db.prepare(
    `INSERT INTO pairings (code, device_id, status, created_at, expires_at)
     VALUES (?, ?, 'pending', ?, ?)`,
  ).run(code, deviceId, ts, expiresAt);

  db.prepare(`INSERT INTO events (device_id, type, ts) VALUES (?, 'pairing.issued', ?)`).run(deviceId, ts);
  return getPairing(code)!;
}

export function getPairing(code: string): PairingRow | undefined {
  const row = db.prepare(`SELECT * FROM pairings WHERE code=?`).get(code) as PairingRow | undefined;
  if (!row) return undefined;
  // 만료됐는데 아직 pending 이면 조회 시점에 정리한다.
  if (row.status === 'pending' && row.expires_at <= now()) {
    db.prepare(`UPDATE pairings SET status='expired' WHERE code=? AND status='pending'`).run(code);
    return { ...row, status: 'expired' };
  }
  return row;
}

export interface ClaimResult {
  ok: boolean;
  reason?: 'not_found' | 'expired' | 'already_claimed';
  sessionId?: string;
  visitorId?: string;
  /** 이번 방문이 몇 번째인지. 첫 방문은 1. */
  visitCount?: number;
}

/**
 * 폰이 호출한다. 성공하면 세션이 만들어지고 PAD의 폴링이 이를 감지한다.
 * 언어는 app 계정 설정이 있으면 그것을, 없으면 PAD에서 고른 값을 쓴다.
 */
export function claimPairing(code: string, identity: AppIdentity, fallbackLang = 'vi'): ClaimResult {
  const pairing = getPairing(code);
  if (!pairing) return { ok: false, reason: 'not_found' };
  if (pairing.status === 'claimed') return { ok: false, reason: 'already_claimed' };
  if (pairing.status === 'expired') return { ok: false, reason: 'expired' };

  const ts = now();
  const visitorId = visitorIdOf(identity.appUserId);
  const sessionId = randomUUID();

  /*
   * 승자 결정. 같은 코드에 동시 요청이 와도 여기서 한 건만 통과한다.
   * (node:sqlite 는 단일 프로세스 직렬 실행이라 이 UPDATE 자체가 경계가 된다)
   */
  const res = db.prepare(
    `UPDATE pairings SET status='claimed', visitor_id=?, session_id=?, claimed_at=?
     WHERE code=? AND status='pending'`,
  ).run(visitorId, sessionId, ts, code);
  if (res.changes === 0) return { ok: false, reason: 'already_claimed' };

  // 방문자 기록 — 첫 방문이 1이 되도록 삽입 시점에 1로 시작한다.
  db.prepare(
    `INSERT INTO visitors (id, visit_count, first_seen_at, last_seen_at) VALUES (?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET visit_count = visit_count + 1, last_seen_at = excluded.last_seen_at`,
  ).run(visitorId, ts, ts);
  const visitCount = (db.prepare(`SELECT visit_count n FROM visitors WHERE id=?`).get(visitorId) as { n: number }).n;

  db.prepare(
    `INSERT INTO sessions (id, device_id, visitor_id, language, status, started_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run(sessionId, pairing.device_id, visitorId, identity.language ?? fallbackLang, ts);

  db.prepare(
    `INSERT INTO events (session_id, device_id, type, payload, ts) VALUES (?, ?, 'pairing.claimed', ?, ?)`,
  ).run(sessionId, pairing.device_id, JSON.stringify({ visitCount }), ts);

  return { ok: true, sessionId, visitorId, visitCount };
}

/** PAD를 초기화할 때(고객 이탈 등) 발급해 둔 코드를 버린다. */
export function cancelPairings(deviceId: string): number {
  const res = db.prepare(`UPDATE pairings SET status='expired' WHERE device_id=? AND status='pending'`).run(deviceId);
  return Number(res.changes);
}

/** 만료된 코드 정리. 서버 기동 시 주기 실행. */
export function sweepExpiredPairings(): number {
  const res = db.prepare(`UPDATE pairings SET status='expired' WHERE status='pending' AND expires_at <= ?`).run(now());
  return Number(res.changes);
}
