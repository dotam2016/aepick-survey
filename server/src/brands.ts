import type { Axis, Language, PersonaId } from '@aepick/shared';

/**
 * ─────────────────────────────────────────────────────────────
 *  AEPICK 입점 브랜드 카탈로그 — 운영자 직접 수정 영역
 * ─────────────────────────────────────────────────────────────
 *  · 브랜드를 추가/삭제하려면 아래 BRANDS 배열만 편집하면 된다.
 *  · personaTags: 이 브랜드를 우선 추천할 DNA 유형 (없으면 축 친화도로만 매칭)
 *  · axisAffinity: 6축 중 이 브랜드가 강한 축 (0~1)
 *  · products: 브랜드별 대표 제품 (권장 2~3개)
 *  · 현재 값은 예시 데이터이므로 실제 입점 브랜드·제품으로 교체해 사용한다.
 */

export interface BrandProduct {
  id: string;
  name: Record<Language, string>;
  price: string;        // 표시용 문자열 (통화 포함)
  shopUrl: string;
}

export interface Brand {
  id: string;
  name: string;                       // 브랜드명은 번역하지 않음 (고유명)
  tagline: Record<Language, string>;  // 한 줄 소개
  emoji: string;                      // 로고 확보 전 임시 표식
  personaTags: PersonaId[];
  axisAffinity: Partial<Record<Axis, number>>;
  products: BrandProduct[];
}

export const BRANDS: Brand[] = [
  {
    id: 'b-purelab',
    name: 'PURE LAB',
    tagline: {
      ko: '성분을 공개하는 저자극 스킨케어',
      en: 'Low-irritation skincare with full disclosure',
      vi: 'Skincare dịu nhẹ, công khai thành phần',
    },
    emoji: '🧪',
    personaTags: ['trustGuardian', 'loyalGlowKeeper'],
    axisAffinity: { care: 0.95, trust: 0.7 },
    products: [
      { id: 'b1p1', name: { ko: '시카 릴리프 세럼', en: 'Cica Relief Serum', vi: 'Serum Cica Phục Hồi' }, price: '₩32,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b1p2', name: { ko: '판테놀 배리어 크림', en: 'Panthenol Barrier Cream', vi: 'Kem Panthenol Bảo Vệ Da' }, price: '₩28,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-glowdaily',
    name: 'GLOW DAILY',
    tagline: {
      ko: '매일 쓰기 좋은 데일리 글로우 라인',
      en: 'Everyday glow you can keep up with',
      vi: 'Dòng dưỡng sáng dùng mỗi ngày',
    },
    emoji: '✨',
    personaTags: ['loyalGlowKeeper', 'smartBeautyCurator'],
    axisAffinity: { repick: 0.9, value: 0.6 },
    products: [
      { id: 'b2p1', name: { ko: '데일리 글로우 토너', en: 'Daily Glow Toner', vi: 'Toner Dưỡng Sáng Hằng Ngày' }, price: '₩19,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b2p2', name: { ko: '리필 글로우 로션', en: 'Refill Glow Lotion', vi: 'Sữa Dưỡng Glow Có Refill' }, price: '₩23,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-hanoifit',
    name: 'HANOI FIT',
    tagline: {
      ko: '하노이 기후에 맞춘 가벼운 제형',
      en: 'Light textures tuned for Hanoi weather',
      vi: 'Kết cấu nhẹ hợp khí hậu Hà Nội',
    },
    emoji: '🌤',
    personaTags: ['localBeautyExpert'],
    axisAffinity: { localFit: 0.98, value: 0.5 },
    products: [
      { id: 'b3p1', name: { ko: '노멜트 선 플루이드', en: 'No-Melt Sun Fluid', vi: 'Kem Chống Nắng Không Trôi' }, price: '₩21,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b3p2', name: { ko: '포켓 하이드라 미스트', en: 'Pocket Hydra Mist', vi: 'Xịt Khoáng Bỏ Túi' }, price: '₩14,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-wavemuse',
    name: 'WAVE MUSE',
    tagline: {
      ko: '가장 빠른 컬러 트렌드를 담은 메이크업',
      en: 'Makeup that catches the color wave first',
      vi: 'Trang điểm bắt trọn xu hướng màu mới',
    },
    emoji: '🌊',
    personaTags: ['trendMuse', 'beautyExplorer'],
    axisAffinity: { trend: 0.97 },
    products: [
      { id: 'b4p1', name: { ko: '네온 웨이브 틴트', en: 'Neon Wave Tint', vi: 'Son Tint Neon Wave' }, price: '₩16,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b4p2', name: { ko: 'Y2K 글리터 팔레트', en: 'Y2K Glitter Palette', vi: 'Bảng Mắt Y2K Glitter' }, price: '₩26,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-provenkit',
    name: 'PROVEN KIT',
    tagline: {
      ko: '리뷰와 임상으로 검증된 스테디셀러',
      en: 'Steady sellers proven by reviews and trials',
      vi: 'Sản phẩm bán chạy được kiểm chứng',
    },
    emoji: '🏅',
    personaTags: ['smartBeautyCurator', 'trustGuardian'],
    axisAffinity: { trust: 0.95, value: 0.7 },
    products: [
      { id: 'b5p1', name: { ko: '5성 리뷰 마스크팩', en: '5-Star Reviewed Mask', vi: 'Mặt Nạ Đánh Giá 5 Sao' }, price: '₩12,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b5p2', name: { ko: '더마 테스트 앰플', en: 'Derma-Tested Ampoule', vi: 'Ampoule Kiểm Nghiệm Da Liễu' }, price: '₩34,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-smartvalue',
    name: 'SMART VALUE',
    tagline: {
      ko: '용량과 가격이 정직한 가성비 라인',
      en: 'Honest size and price, real value',
      vi: 'Dung tích và giá minh bạch, đáng tiền',
    },
    emoji: '💎',
    personaTags: ['smartBeautyCurator', 'localBeautyExpert'],
    axisAffinity: { value: 0.96, repick: 0.5 },
    products: [
      { id: 'b6p1', name: { ko: '메가 밸류 토너 500ml', en: 'Mega Value Toner 500ml', vi: 'Toner Dung Tích Lớn 500ml' }, price: '₩18,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b6p2', name: { ko: '베스트 리픽 립밤', en: 'Best-Repick Lip Balm', vi: 'Son Dưỡng Best-Repick' }, price: '₩9,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
  {
    id: 'b-newmoment',
    name: 'NEW MOMENT',
    tagline: {
      ko: '새로운 시도를 즐기는 실험적 라인',
      en: 'An experimental line for the curious',
      vi: 'Dòng thử nghiệm cho người thích khám phá',
    },
    emoji: '🚀',
    personaTags: ['beautyExplorer', 'trendMuse'],
    axisAffinity: { trend: 0.8, repick: 0.6 },
    products: [
      { id: 'b7p1', name: { ko: '무드 체인지 블러셔', en: 'Mood Change Blusher', vi: 'Má Hồng Đổi Sắc' }, price: '₩17,000', shopUrl: 'https://shopee.vn/aepick' },
      { id: 'b7p2', name: { ko: '텍스처 실험 세럼', en: 'Texture Lab Serum', vi: 'Serum Thử Nghiệm Kết Cấu' }, price: '₩29,000', shopUrl: 'https://shopee.vn/aepick' },
    ],
  },
];

/** 추천 브랜드 수 (3~5) */
export const BRAND_PICK_COUNT = 4;

/** 페르소나 태그 우선 → 상위 2축 친화도 순으로 브랜드 선정 */
export function recommendBrands(persona: PersonaId, topAxes: [Axis, Axis], count = BRAND_PICK_COUNT): Brand[] {
  const scored = BRANDS.map((b) => {
    const tagBonus = b.personaTags.includes(persona) ? 10 : 0;
    const affinity = (b.axisAffinity[topAxes[0]] ?? 0) * 1.4 + (b.axisAffinity[topAxes[1]] ?? 0);
    return { b, score: tagBonus + affinity };
  });
  return scored.sort((x, y) => y.score - x.score).slice(0, count).map((x) => x.b);
}
