import type { Axis, PersonaId } from '@aepick/shared';

export interface Product {
  id: string;
  name: Record<'vi' | 'en' | 'ko', string>;
  category: string;
  personaTags: PersonaId[];
  axisAffinity: Partial<Record<Axis, number>>; // 0~1
  reasonKey: string;
  shopUrl: string;
}

/** 프로토타입 목업 카탈로그 12종 (기능정의서 5장) */
export const PRODUCTS: Product[] = [
  {
    id: 'p01', category: 'serum',
    name: { vi: 'Serum Phục Hồi Hàng Rào Da', en: 'Barrier Repair Serum', ko: '배리어 리페어 세럼' },
    personaTags: ['loyalGlowKeeper', 'trustGuardian'],
    axisAffinity: { repick: 0.9, care: 0.8 },
    reasonKey: 'products.reasons.steady', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p02', category: 'cream',
    name: { vi: 'Kem Dưỡng Ẩm Sâu 72h', en: '72h Deep Moist Cream', ko: '72시간 딥 모이스트 크림' },
    personaTags: ['loyalGlowKeeper'],
    axisAffinity: { repick: 0.8, localFit: 0.5 },
    reasonKey: 'products.reasons.steady', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p03', category: 'essence',
    name: { vi: 'Tinh Chất Thành Phần Tối Giản', en: 'Clean Formula Essence', ko: '클린 포뮬러 에센스' },
    personaTags: ['trustGuardian'],
    axisAffinity: { care: 0.95, trust: 0.6 },
    reasonKey: 'products.reasons.clean', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p04', category: 'sunscreen',
    name: { vi: 'Kem Chống Nắng Không Trôi', en: 'No-Melt Sunscreen', ko: '노멜트 선스크린' },
    personaTags: ['localBeautyExpert'],
    axisAffinity: { localFit: 0.95, value: 0.5 },
    reasonKey: 'products.reasons.climate', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p05', category: 'cushion',
    name: { vi: 'Cushion Chuẩn Màu Da Việt', en: 'Local Tone Cushion', ko: '로컬 톤 쿠션' },
    personaTags: ['localBeautyExpert', 'trendMuse'],
    axisAffinity: { localFit: 0.85, trend: 0.6 },
    reasonKey: 'products.reasons.climate', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p06', category: 'tint',
    name: { vi: 'Tint Màu Neon Wave', en: 'Neon Wave Tint', ko: '네온 웨이브 틴트' },
    personaTags: ['trendMuse', 'beautyExplorer'],
    axisAffinity: { trend: 0.95 },
    reasonKey: 'products.reasons.trend', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p07', category: 'palette',
    name: { vi: 'Bảng Mắt Y2K Glitter', en: 'Y2K Glitter Palette', ko: 'Y2K 글리터 팔레트' },
    personaTags: ['beautyExplorer'],
    axisAffinity: { trend: 0.85, repick: 0.4 },
    reasonKey: 'products.reasons.trend', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p08', category: 'toner',
    name: { vi: 'Toner Giá Trị Dung Tích Lớn', en: 'Mega Value Toner', ko: '메가 밸류 토너' },
    personaTags: ['smartBeautyCurator'],
    axisAffinity: { value: 0.95, repick: 0.5 },
    reasonKey: 'products.reasons.value', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p09', category: 'mask',
    name: { vi: 'Mặt Nạ Đánh Giá 5 Sao', en: '5-Star Reviewed Mask', ko: '별 다섯 개 리뷰 마스크' },
    personaTags: ['smartBeautyCurator', 'trustGuardian'],
    axisAffinity: { trust: 0.9, value: 0.5 },
    reasonKey: 'products.reasons.reviewed', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p10', category: 'mist',
    name: { vi: 'Xịt Khoáng Bỏ Túi', en: 'Pocket Hydra Mist', ko: '포켓 하이드라 미스트' },
    personaTags: ['localBeautyExpert', 'beautyExplorer'],
    axisAffinity: { localFit: 0.7, trend: 0.4 },
    reasonKey: 'products.reasons.portable', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p11', category: 'ampoule',
    name: { vi: 'Ampoule Kiểm Nghiệm Da Liễu', en: 'Derma-Tested Ampoule', ko: '더마 테스트 앰플' },
    personaTags: ['trustGuardian', 'loyalGlowKeeper'],
    axisAffinity: { care: 0.85, trust: 0.7 },
    reasonKey: 'products.reasons.clean', shopUrl: 'https://shopee.vn/aepick',
  },
  {
    id: 'p12', category: 'lipbalm',
    name: { vi: 'Son Dưỡng Best-Repick', en: 'Best-Repick Lip Balm', ko: '베스트 리픽 립밤' },
    personaTags: ['loyalGlowKeeper', 'smartBeautyCurator'],
    axisAffinity: { repick: 0.85, value: 0.6 },
    reasonKey: 'products.reasons.steady', shopUrl: 'https://shopee.vn/aepick',
  },
];

/** 추천: 페르소나 태그 일치 우선 → 상위 2축 친화도 합 순 → 3종 */
export function recommend(persona: PersonaId, topAxes: [Axis, Axis]): Product[] {
  const scored = PRODUCTS.map((p) => {
    const tagBonus = p.personaTags.includes(persona) ? 10 : 0;
    const affinity = (p.axisAffinity[topAxes[0]] ?? 0) + (p.axisAffinity[topAxes[1]] ?? 0);
    return { p, score: tagBonus + affinity };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.p);
}
