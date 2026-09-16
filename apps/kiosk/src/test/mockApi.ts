/**
 * 갤러리 전용 API 목업.
 *
 * 백엔드(server)를 켜지 않아도 화면이 "데이터가 들어온 상태"로 보이도록
 * window.fetch를 가로채 /api/* 요청에만 가짜 응답을 돌려준다.
 * /api 외의 요청(에셋·폰트 등)은 원래 fetch로 그대로 넘긴다.
 */
import {
  MOCK_PERCENTILE, MOCK_PERSONA, MOCK_SCORES, MOCK_SESSION_ID, MOCK_TOKEN,
  MOCK_TODAY_STATS, MOCK_KIOSK_PRODUCTS, MOCK_BRANDS, fakeQrDataUri,
} from './mockData';

const json = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

function route(method: string, path: string): Response | null {
  if (method === 'GET' && path === '/api/stats/today') return json(MOCK_TODAY_STATS);
  if (method === 'POST' && path === '/api/sessions') return json({ sessionId: MOCK_SESSION_ID });
  if (method === 'POST' && path === '/api/events') return json({ accepted: 1 });
  if (method === 'PATCH' && /^\/api\/sessions\/[^/]+\/language$/.test(path)) return json({ language: 'vi' });
  if (method === 'POST' && /^\/api\/sessions\/[^/]+\/answers\/[^/]+$/.test(path))
    return json({ score: 82, subtype: 'mock' });
  if (method === 'POST' && /^\/api\/sessions\/[^/]+\/complete$/.test(path)) {
    return json({
      scores: MOCK_SCORES,
      persona: MOCK_PERSONA,
      percentile: MOCK_PERCENTILE,
      resultToken: MOCK_TOKEN,
      qrPngUrl: fakeQrDataUri(),
      resultUrl: `${location.origin}/r/${MOCK_TOKEN}`,
      brands: MOCK_BRANDS.slice(0, 3).map((b) => ({
        id: b.id, name: b.name, tagline: b.tagline, emoji: b.emoji, logoUrl: b.logoUrl,
      })),
      products: MOCK_KIOSK_PRODUCTS,
    });
  }
  if (path.startsWith('/api/')) return json({});
  return null;
}

export function installMockApi() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
    const mocked = route(method, path);
    if (mocked) {
      // 실제 네트워크 지연과 비슷한 리듬을 만들어 로딩 연출을 확인할 수 있게 한다
      await new Promise((r) => setTimeout(r, 120));
      return mocked;
    }
    return original(input as RequestInfo, init);
  };
}
