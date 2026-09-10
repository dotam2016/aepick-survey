import type {
  CoreKey,
  GameAnswer,
  Language,
  PersonaId,
  Scores,
} from '@aepick/shared';

/**
 * 기기 식별자.
 *
 * PAD를 10대 규모로 운영하므로 기기마다 서로 다른 ID가 있어야 한다.
 * 같은 ID를 쓰면 페어링 코드가 서로를 무효화해 체험이 끊긴다.
 *
 * 설정 방법: 최초 1회 주소창에 ?device=PAD-03 을 붙여 열면 저장된다.
 * 이후에는 파라미터 없이 열어도 유지된다.
 */
function resolveDeviceId(): string {
  const KEY = 'aepick.deviceId';
  const fromUrl = new URLSearchParams(window.location.search).get('device');
  if (fromUrl) {
    localStorage.setItem(KEY, fromUrl);
    return fromUrl;
  }
  const saved = localStorage.getItem(KEY);
  if (saved) return saved;
  // 미설정 기기도 최소한 서로 구분되도록 임의 ID를 부여한다.
  const fallback = `PAD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  localStorage.setItem(KEY, fallback);
  return fallback;
}

export const DEVICE_ID = resolveDeviceId();

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEVICE_ID },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

/** 실패해도 체험을 막지 않는 호출 (백엔드 단절 내성) */
async function tryReq<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  try {
    return await req<T>(method, path, body);
  } catch (e) {
    console.warn(`[api] ${method} ${path} failed:`, e);
    return null;
  }
}

export interface CompleteResponse {
  scores: Scores;
  persona: PersonaId;
  percentile: number;
  resultToken: string;
  qrPngUrl: string;
  resultUrl: string;
  products: { id: string; name: Record<Language, string>; price: string; brandId: string }[];
}

export interface TodayStats {
  totalParticipants: number;
  topPersona: PersonaId | null;
  topCoinSlot: string | null;
  trendVotes: Record<string, Record<string, number>>;
  reviewVotes: Record<string, number>;
}

export const api = {
  /* ── 체험 시작 (익명 세션) ── */
  createSession: (language: Language) =>
    tryReq<{ sessionId: string }>('POST', '/sessions', { deviceId: DEVICE_ID, language }),

  /* ── 체험 ── */
  submitAnswer: (sessionId: string, coreKey: CoreKey, payload: GameAnswer) =>
    tryReq<{ score: number; subtype: string }>('POST', `/sessions/${sessionId}/answers/${coreKey}`, payload),

  complete: (sessionId: string) => tryReq<CompleteResponse>('POST', `/sessions/${sessionId}/complete`, {}),

  todayStats: () => tryReq<TodayStats>('GET', '/stats/today'),

  sendEvent: (type: string, sessionId: string | null, payload: Record<string, unknown> = {}) =>
    tryReq('POST', '/events', { events: [{ type, sessionId, payload, ts: new Date().toISOString() }] }),
};
