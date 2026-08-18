import type {
  Consents,
  CoreKey,
  GameAnswer,
  ImageStatus,
  Language,
  Mood,
  PersonaId,
  Scores,
} from '@aepick/shared';

const DEVICE_ID = 'KIOSK-HN-01';

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
  products: { id: string; name: Record<Language, string>; category: string; reasonKey: string }[];
}

export interface TodayStats {
  totalParticipants: number;
  topPersona: PersonaId | null;
  topCoinSlot: string | null;
  trendVotes: Record<string, Record<string, number>>;
  reviewVotes: Record<string, number>;
}

export const api = {
  createSession: (language: Language) =>
    tryReq<{ sessionId: string }>('POST', '/sessions', { deviceId: DEVICE_ID, language }),

  setConsent: (
    sessionId: string,
    consents: Consents,
    extra: { nickname?: string; ageGroup?: string; avatarId?: string },
  ) => tryReq('PATCH', `/sessions/${sessionId}/consent`, { consents, ...extra }),

  uploadPhoto: async (sessionId: string, dataUrl: string, mood: Mood): Promise<boolean> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const form = new FormData();
      form.append('photo', blob, 'photo.jpg');
      form.append('mood', mood);
      const res = await fetch(`/api/sessions/${sessionId}/photo`, {
        method: 'POST',
        headers: { 'X-Device-Id': DEVICE_ID },
        body: form,
      });
      return res.ok;
    } catch (e) {
      console.warn('[api] photo upload failed:', e);
      return false;
    }
  },

  submitAnswer: (sessionId: string, coreKey: CoreKey, payload: GameAnswer) =>
    tryReq<{ score: number; subtype: string }>('POST', `/sessions/${sessionId}/answers/${coreKey}`, payload),

  complete: (sessionId: string) => tryReq<CompleteResponse>('POST', `/sessions/${sessionId}/complete`, {}),

  imageStatus: (sessionId: string) =>
    tryReq<{ status: ImageStatus; imageUrl?: string }>('GET', `/sessions/${sessionId}/image-status`),

  todayStats: () => tryReq<TodayStats>('GET', '/stats/today'),

  sendEvent: (type: string, sessionId: string | null, payload: Record<string, unknown> = {}) =>
    tryReq('POST', '/events', { events: [{ type, sessionId, payload, ts: new Date().toISOString() }] }),
};
