/**
 * ─────────────────────────────────────────────────────────────
 *  FE 테스트 갤러리 — 목업 데이터 (Mock data cho bản Test FE)
 * ─────────────────────────────────────────────────────────────
 *
 * 서버(백엔드) 없이도 모든 화면이 "실제 데이터가 들어온 상태"로 보이게 한다.
 * 브라우저 하네스(src/test/*)와 vite 플러그인(fe-test-pages.ts)이 함께 쓰므로
 * 순수 데이터·순수 함수만 둔다. DOM·Node API를 쓰면 vite.config.ts에서 import할 수 없다.
 */

export const MOCK_TOKEN = 'demo-token-aepick';
export const MOCK_PAIR_CODE = 'DEMO42';
export const MOCK_SESSION_ID = 'demo-session';
export const MOCK_COUPON = 'AEPICK-DEMO42';

/** 상위 2축이 trend + localFit → 페르소나는 Trend Muse로 확정된다 */
export const MOCK_SCORES = { repick: 64, value: 71, care: 58, trend: 93, localFit: 86, trust: 49 };
export const MOCK_PERSONA = 'trendMuse';
export const MOCK_PERCENTILE = 17;

const SHOP = 'https://shopee.vn/aepick';
const L = (ko: string, en: string, vi: string) => ({ ko, en, vi });

/** 카탈로그(브랜드·제품) — 결과·투표·어드민 화면이 모두 이 목록을 쓴다 */
export const MOCK_BRANDS = [
  {
    id: 'b04-wavemuse', name: 'WAVE MUSE', emoji: '🌊', logoUrl: null,
    tagline: L('가장 빠른 컬러 트렌드를 담은 메이크업', 'Makeup that catches the color wave first', 'Trang điểm bắt trọn xu hướng màu mới'),
    personaTags: ['trendMuse', 'beautyExplorer'], axisAffinity: { trend: 0.97 },
    sortOrder: 1, active: true,
    products: [
      { id: 'b04p1', brandId: 'b04-wavemuse', name: L('네온 웨이브 틴트', 'Neon Wave Tint', 'Son Tint Neon Wave'), price: '₫160,000', shopUrl: SHOP, imageUrl: null, sortOrder: 1, active: true },
      { id: 'b04p2', brandId: 'b04-wavemuse', name: L('Y2K 글리터 팔레트', 'Y2K Glitter Palette', 'Bảng Mắt Y2K Glitter'), price: '₫260,000', shopUrl: SHOP, imageUrl: null, sortOrder: 2, active: true },
      { id: 'b04p3', brandId: 'b04-wavemuse', name: L('미러 글로스 밤', 'Mirror Gloss Balm', 'Son Bóng Mirror'), price: '₫145,000', shopUrl: SHOP, imageUrl: null, sortOrder: 3, active: true },
    ],
  },
  {
    id: 'b03-hanoifit', name: 'HANOI FIT', emoji: '🌤', logoUrl: null,
    tagline: L('하노이 기후에 맞춘 가벼운 제형', 'Light textures tuned for Hanoi weather', 'Kết cấu nhẹ hợp khí hậu Hà Nội'),
    personaTags: ['localBeautyExpert'], axisAffinity: { localFit: 0.98, value: 0.5 },
    sortOrder: 2, active: true,
    products: [
      { id: 'b03p1', brandId: 'b03-hanoifit', name: L('노멜트 선 플루이드', 'No-Melt Sun Fluid', 'Kem Chống Nắng Không Trôi'), price: '₫210,000', shopUrl: SHOP, imageUrl: null, sortOrder: 1, active: true },
      { id: 'b03p2', brandId: 'b03-hanoifit', name: L('포켓 하이드라 미스트', 'Pocket Hydra Mist', 'Xịt Khoáng Bỏ Túi'), price: '₫140,000', shopUrl: SHOP, imageUrl: null, sortOrder: 2, active: true },
      { id: 'b03p3', brandId: 'b03-hanoifit', name: L('오일 컨트롤 파우더', 'Oil Control Powder', 'Phấn Kiềm Dầu'), price: '₫175,000', shopUrl: SHOP, imageUrl: null, sortOrder: 3, active: true },
    ],
  },
  {
    id: 'b02-glowdaily', name: 'GLOW DAILY', emoji: '✨', logoUrl: null,
    tagline: L('매일 쓰기 좋은 데일리 글로우 라인', 'Everyday glow you can keep up with', 'Dòng dưỡng sáng dùng mỗi ngày'),
    personaTags: ['loyalGlowKeeper', 'smartBeautyCurator'], axisAffinity: { repick: 0.9, value: 0.6 },
    sortOrder: 3, active: true,
    products: [
      { id: 'b02p1', brandId: 'b02-glowdaily', name: L('데일리 글로우 토너', 'Daily Glow Toner', 'Toner Dưỡng Sáng Hằng Ngày'), price: '₫190,000', shopUrl: SHOP, imageUrl: null, sortOrder: 1, active: true },
      { id: 'b02p2', brandId: 'b02-glowdaily', name: L('리필 글로우 로션', 'Refill Glow Lotion', 'Sữa Dưỡng Glow Có Refill'), price: '₫230,000', shopUrl: SHOP, imageUrl: null, sortOrder: 2, active: true },
      { id: 'b02p3', brandId: 'b02-glowdaily', name: L('글로우 나이트 마스크', 'Glow Night Mask', 'Mặt Nạ Ngủ Dưỡng Sáng'), price: '₫250,000', shopUrl: SHOP, imageUrl: null, sortOrder: 3, active: true },
    ],
  },
  {
    id: 'b01-purelab', name: 'PURE LAB', emoji: '🧪', logoUrl: null,
    tagline: L('성분을 공개하는 저자극 스킨케어', 'Low-irritation skincare with full disclosure', 'Skincare dịu nhẹ, công khai thành phần'),
    personaTags: ['trustGuardian', 'loyalGlowKeeper'], axisAffinity: { care: 0.95, trust: 0.7 },
    sortOrder: 4, active: true,
    products: [
      { id: 'b01p1', brandId: 'b01-purelab', name: L('시카 릴리프 세럼', 'Cica Relief Serum', 'Serum Cica Phục Hồi'), price: '₫320,000', shopUrl: SHOP, imageUrl: null, sortOrder: 1, active: true },
      { id: 'b01p2', brandId: 'b01-purelab', name: L('판테놀 배리어 크림', 'Panthenol Barrier Cream', 'Kem Panthenol Bảo Vệ Da'), price: '₫280,000', shopUrl: SHOP, imageUrl: null, sortOrder: 2, active: true },
    ],
  },
  {
    id: 'b05-provenkit', name: 'PROVEN KIT', emoji: '🏅', logoUrl: null,
    tagline: L('리뷰와 임상으로 검증된 스테디셀러', 'Steady sellers proven by reviews and trials', 'Sản phẩm bán chạy được kiểm chứng'),
    personaTags: ['smartBeautyCurator', 'trustGuardian'], axisAffinity: { trust: 0.95, value: 0.7 },
    sortOrder: 5, active: true,
    products: [
      { id: 'b05p1', brandId: 'b05-provenkit', name: L('5성 리뷰 마스크팩', '5-Star Reviewed Mask', 'Mặt Nạ Đánh Giá 5 Sao'), price: '₫120,000', shopUrl: SHOP, imageUrl: null, sortOrder: 1, active: true },
      { id: 'b05p2', brandId: 'b05-provenkit', name: L('더마 테스트 앰플', 'Derma-Tested Ampoule', 'Ampoule Kiểm Nghiệm Da Liễu'), price: '₫340,000', shopUrl: SHOP, imageUrl: null, sortOrder: 2, active: true },
    ],
  },
];

/** 키오스크 state.products (DNA 결과 이후 추천 제품) */
export const MOCK_KIOSK_PRODUCTS = MOCK_BRANDS.slice(0, 3).map((b) => ({
  id: b.products[0].id, name: b.products[0].name, price: b.products[0].price, brandId: b.id,
}));

/** GET /api/stats/today */
export const MOCK_TODAY_STATS = {
  totalParticipants: 1284,
  topPersona: MOCK_PERSONA,
  topCoinSlot: 'effect',
  trendVotes: {},
  reviewVotes: {},
};

/** GET /api/results/:token — 모바일 결과 페이지 */
export function mockResultData(language = 'vi') {
  return {
    persona: MOCK_PERSONA,
    language,
    scores: MOCK_SCORES,
    coupon: MOCK_COUPON,
    expiresAt: new Date(Date.now() + 41 * 3600_000).toISOString(),
    products: MOCK_KIOSK_PRODUCTS,
    brands: MOCK_BRANDS.slice(0, 3),
  };
}

/** GET /api/vote/:token/options */
export const MOCK_VOTE_OPTIONS = {
  pickCount: 3,
  alreadyVoted: false,
  picked: [] as string[],
  brands: MOCK_BRANDS.map((b) => ({
    id: b.id, name: b.name, emoji: b.emoji, logoUrl: b.logoUrl, tagline: b.tagline,
    products: b.products.map((p) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl })),
  })),
};

/** GET /api/vote/:token/status — 투표 완료 화면용 */
export const MOCK_VOTE_STATUS_DONE = {
  voted: true,
  rewardClaimedAt: null as string | null,
  picks: [
    { id: 'b04p1', emoji: '🌊', name: MOCK_BRANDS[0].products[0].name, brand: 'WAVE MUSE' },
    { id: 'b03p1', emoji: '🌤', name: MOCK_BRANDS[1].products[0].name, brand: 'HANOI FIT' },
    { id: 'b02p2', emoji: '✨', name: MOCK_BRANDS[2].products[1].name, brand: 'GLOW DAILY' },
  ],
};

/** POST /api/vote/:token/staff — 직원 PIN 확인 결과 */
export const MOCK_STAFF_LOOKUP = { visitCount: 3, rewardClaimedAt: null as string | null };

/** GET /api/admin/overview */
export const MOCK_ADMIN_OVERVIEW = {
  today: { started: 214, completed: 168, abandoned: 31, active: 4 },
  completionRate: 79,
  avgDurationSec: 287,
  qr: { issued: 168, scanned: 131, scanRate: 78 },
  downloads: 96,
  retakeRate: 12,
  devices: [],
};

/** GET /api/admin/analytics */
export const MOCK_ADMIN_ANALYTICS = {
  axisAverages: MOCK_SCORES,
  personaDistribution: [
    { persona: 'trendMuse', n: 48 },
    { persona: 'localBeautyExpert', n: 35 },
    { persona: 'trustGuardian', n: 27 },
    { persona: 'smartBeautyCurator', n: 24 },
    { persona: 'loyalGlowKeeper', n: 19 },
    { persona: 'beautyExplorer', n: 15 },
  ],
  hourlyParticipants: [
    { hour: '10', n: 12 }, { hour: '11', n: 25 }, { hour: '12', n: 31 },
    { hour: '13', n: 28 }, { hour: '14', n: 44 }, { hour: '15', n: 39 },
  ],
  subtypes: { repick: [], value: [], care: [], trend: [], localFit: [], trust: [] },
  marketingConsents: 64,
  productClicks: [{ pid: 'b04p1', n: 23 }, { pid: 'b03p1', n: 17 }],
};

/** GET /api/admin/sessions */
export const MOCK_ADMIN_SESSIONS = {
  page: 1,
  sessions: Array.from({ length: 12 }).map((_, i) => {
    const started = new Date(Date.now() - i * 7 * 60_000).toISOString();
    const personas = ['trendMuse', 'localBeautyExpert', 'trustGuardian', 'smartBeautyCurator', null];
    return {
      id: `sess-${100 + i}`,
      device_id: `PAD-0${(i % 6) + 1}`,
      language: (['vi', 'vi', 'en', 'ko'] as const)[i % 4],
      status: i % 5 === 4 ? 'active' : 'completed',
      persona: i % 5 === 4 ? null : personas[i % 4],
      started_at: started,
      completed_at: i % 5 === 4 ? null : new Date(Date.parse(started) + 290_000).toISOString(),
    };
  }),
};

/**
 * 가짜 QR 이미지 (data URI).
 * 서버가 만들어 주는 진짜 QR 대신, 같은 크기·같은 밀도로 보이는 그림을 그린다.
 * 디자인 검수용이므로 스캔되지 않는다.
 */
export function fakeQrDataUri(seedText = MOCK_TOKEN, cells = 25): string {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 0xffffffff; };
  const finder = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#111"/>`;
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= cells - 8 && y < 8) || (x < 8 && y >= cells - 8);
  let dots = '';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (inFinder(x, y)) continue;
      if (rand() > 0.52) dots += `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${cells + 2} ${cells + 2}" shape-rendering="crispEdges">` +
    `<rect x="-1" y="-1" width="${cells + 2}" height="${cells + 2}" fill="#fff"/>` +
    dots + finder(0, 0) + finder(cells - 7, 0) + finder(0, cells - 7) +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
