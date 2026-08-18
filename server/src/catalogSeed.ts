import { db } from './db.js';
import { upsertBrand, upsertProduct, type BrandInput, type ProductInput } from './catalog.js';

/**
 * 팝업 운영 규모(브랜드 10개)에 맞춘 더미 카탈로그.
 *
 * 실제 입점 브랜드가 확정되기 전까지 쓰는 자리끼우기 데이터다.
 * 어드민에서 이름·소개·제품을 실제 값으로 바꾸면 그대로 반영된다.
 *
 * 시드는 브랜드 테이블이 비어 있을 때만 1회 실행된다.
 * 운영자가 지운 브랜드가 재기동 때 되살아나면 안 되기 때문.
 */

type Seed = Omit<BrandInput, 'sortOrder'> & { products: Omit<ProductInput, 'brandId' | 'sortOrder'>[] };

const L = (ko: string, en: string, vi: string) => ({ ko, en, vi });
const SHOP = 'https://shopee.vn/aepick';

const SEEDS: Seed[] = [
  {
    id: 'b01-purelab', name: 'PURE LAB', emoji: '🧪',
    tagline: L('성분을 공개하는 저자극 스킨케어', 'Low-irritation skincare with full disclosure', 'Skincare dịu nhẹ, công khai thành phần'),
    personaTags: ['trustGuardian', 'loyalGlowKeeper'], axisAffinity: { care: 0.95, trust: 0.7 },
    products: [
      { id: 'b01p1', name: L('시카 릴리프 세럼', 'Cica Relief Serum', 'Serum Cica Phục Hồi'), price: '₫320,000', shopUrl: SHOP },
      { id: 'b01p2', name: L('판테놀 배리어 크림', 'Panthenol Barrier Cream', 'Kem Panthenol Bảo Vệ Da'), price: '₫280,000', shopUrl: SHOP },
      { id: 'b01p3', name: L('무향 클렌징 젤', 'Fragrance-Free Cleansing Gel', 'Gel Rửa Mặt Không Hương'), price: '₫190,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b02-glowdaily', name: 'GLOW DAILY', emoji: '✨',
    tagline: L('매일 쓰기 좋은 데일리 글로우 라인', 'Everyday glow you can keep up with', 'Dòng dưỡng sáng dùng mỗi ngày'),
    personaTags: ['loyalGlowKeeper', 'smartBeautyCurator'], axisAffinity: { repick: 0.9, value: 0.6 },
    products: [
      { id: 'b02p1', name: L('데일리 글로우 토너', 'Daily Glow Toner', 'Toner Dưỡng Sáng Hằng Ngày'), price: '₫190,000', shopUrl: SHOP },
      { id: 'b02p2', name: L('리필 글로우 로션', 'Refill Glow Lotion', 'Sữa Dưỡng Glow Có Refill'), price: '₫230,000', shopUrl: SHOP },
      { id: 'b02p3', name: L('글로우 나이트 마스크', 'Glow Night Mask', 'Mặt Nạ Ngủ Dưỡng Sáng'), price: '₫250,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b03-hanoifit', name: 'HANOI FIT', emoji: '🌤',
    tagline: L('하노이 기후에 맞춘 가벼운 제형', 'Light textures tuned for Hanoi weather', 'Kết cấu nhẹ hợp khí hậu Hà Nội'),
    personaTags: ['localBeautyExpert'], axisAffinity: { localFit: 0.98, value: 0.5 },
    products: [
      { id: 'b03p1', name: L('노멜트 선 플루이드', 'No-Melt Sun Fluid', 'Kem Chống Nắng Không Trôi'), price: '₫210,000', shopUrl: SHOP },
      { id: 'b03p2', name: L('포켓 하이드라 미스트', 'Pocket Hydra Mist', 'Xịt Khoáng Bỏ Túi'), price: '₫140,000', shopUrl: SHOP },
      { id: 'b03p3', name: L('오일 컨트롤 파우더', 'Oil Control Powder', 'Phấn Kiềm Dầu'), price: '₫175,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b04-wavemuse', name: 'WAVE MUSE', emoji: '🌊',
    tagline: L('가장 빠른 컬러 트렌드를 담은 메이크업', 'Makeup that catches the color wave first', 'Trang điểm bắt trọn xu hướng màu mới'),
    personaTags: ['trendMuse', 'beautyExplorer'], axisAffinity: { trend: 0.97 },
    products: [
      { id: 'b04p1', name: L('네온 웨이브 틴트', 'Neon Wave Tint', 'Son Tint Neon Wave'), price: '₫160,000', shopUrl: SHOP },
      { id: 'b04p2', name: L('Y2K 글리터 팔레트', 'Y2K Glitter Palette', 'Bảng Mắt Y2K Glitter'), price: '₫260,000', shopUrl: SHOP },
      { id: 'b04p3', name: L('미러 글로스 밤', 'Mirror Gloss Balm', 'Son Bóng Mirror'), price: '₫145,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b05-provenkit', name: 'PROVEN KIT', emoji: '🏅',
    tagline: L('리뷰와 임상으로 검증된 스테디셀러', 'Steady sellers proven by reviews and trials', 'Sản phẩm bán chạy được kiểm chứng'),
    personaTags: ['smartBeautyCurator', 'trustGuardian'], axisAffinity: { trust: 0.95, value: 0.7 },
    products: [
      { id: 'b05p1', name: L('5성 리뷰 마스크팩', '5-Star Reviewed Mask', 'Mặt Nạ Đánh Giá 5 Sao'), price: '₫120,000', shopUrl: SHOP },
      { id: 'b05p2', name: L('더마 테스트 앰플', 'Derma-Tested Ampoule', 'Ampoule Kiểm Nghiệm Da Liễu'), price: '₫340,000', shopUrl: SHOP },
      { id: 'b05p3', name: L('임상 리페어 크림', 'Clinical Repair Cream', 'Kem Phục Hồi Lâm Sàng'), price: '₫310,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b06-smartvalue', name: 'SMART VALUE', emoji: '💎',
    tagline: L('용량과 가격이 정직한 가성비 라인', 'Honest size and price, real value', 'Dung tích và giá minh bạch, đáng tiền'),
    personaTags: ['smartBeautyCurator', 'localBeautyExpert'], axisAffinity: { value: 0.96, repick: 0.5 },
    products: [
      { id: 'b06p1', name: L('메가 밸류 토너 500ml', 'Mega Value Toner 500ml', 'Toner Dung Tích Lớn 500ml'), price: '₫180,000', shopUrl: SHOP },
      { id: 'b06p2', name: L('베스트 리픽 립밤', 'Best-Repick Lip Balm', 'Son Dưỡng Best-Repick'), price: '₫90,000', shopUrl: SHOP },
      { id: 'b06p3', name: L('대용량 클렌징 워터', 'Jumbo Cleansing Water', 'Nước Tẩy Trang Dung Tích Lớn'), price: '₫150,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b07-newmoment', name: 'NEW MOMENT', emoji: '🚀',
    tagline: L('새로운 시도를 즐기는 실험적 라인', 'An experimental line for the curious', 'Dòng thử nghiệm cho người thích khám phá'),
    personaTags: ['beautyExplorer', 'trendMuse'], axisAffinity: { trend: 0.8, repick: 0.6 },
    products: [
      { id: 'b07p1', name: L('무드 체인지 블러셔', 'Mood Change Blusher', 'Má Hồng Đổi Sắc'), price: '₫170,000', shopUrl: SHOP },
      { id: 'b07p2', name: L('텍스처 실험 세럼', 'Texture Lab Serum', 'Serum Thử Nghiệm Kết Cấu'), price: '₫290,000', shopUrl: SHOP },
      { id: 'b07p3', name: L('컬러 체인지 립오일', 'Color-Change Lip Oil', 'Dầu Dưỡng Môi Đổi Màu'), price: '₫155,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b08-herbfolk', name: 'HERB FOLK', emoji: '🌿',
    tagline: L('식물 원료 중심의 순한 케어', 'Gentle care built on botanical actives', 'Chăm sóc dịu nhẹ từ thảo mộc'),
    personaTags: ['trustGuardian', 'localBeautyExpert'], axisAffinity: { care: 0.85, localFit: 0.6 },
    products: [
      { id: 'b08p1', name: L('허브 진정 토너', 'Herbal Calming Toner', 'Toner Thảo Mộc Làm Dịu'), price: '₫200,000', shopUrl: SHOP },
      { id: 'b08p2', name: L('그린티 클렌징 폼', 'Green Tea Cleansing Foam', 'Sữa Rửa Mặt Trà Xanh'), price: '₫160,000', shopUrl: SHOP },
      { id: 'b08p3', name: L('약산성 바디 워시', 'Mild pH Body Wash', 'Sữa Tắm Dịu Nhẹ'), price: '₫185,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b09-lumiere', name: 'LUMIÈRE', emoji: '💫',
    tagline: L('광채에 집중한 프리미엄 라인', 'A premium line focused on radiance', 'Dòng cao cấp tập trung vào độ rạng rỡ'),
    personaTags: ['loyalGlowKeeper', 'trendMuse'], axisAffinity: { repick: 0.7, trend: 0.65 },
    products: [
      { id: 'b09p1', name: L('래디언스 부스터 앰플', 'Radiance Booster Ampoule', 'Ampoule Tăng Sáng'), price: '₫420,000', shopUrl: SHOP },
      { id: 'b09p2', name: L('실크 글로우 프라이머', 'Silk Glow Primer', 'Kem Lót Silk Glow'), price: '₫330,000', shopUrl: SHOP },
      { id: 'b09p3', name: L('펄 하이라이터', 'Pearl Highlighter', 'Phấn Bắt Sáng Ngọc Trai'), price: '₫270,000', shopUrl: SHOP },
    ],
  },
  {
    id: 'b10-dailyroutine', name: 'DAILY ROUTINE', emoji: '🗓',
    tagline: L('아침저녁 루틴을 단순하게', 'Simplify your morning and night routine', 'Đơn giản hóa routine sáng và tối'),
    personaTags: ['loyalGlowKeeper', 'smartBeautyCurator'], axisAffinity: { repick: 0.85, care: 0.55 },
    products: [
      { id: 'b10p1', name: L('모닝 라이트 로션', 'Morning Light Lotion', 'Sữa Dưỡng Buổi Sáng'), price: '₫210,000', shopUrl: SHOP },
      { id: 'b10p2', name: L('나이트 리커버 크림', 'Night Recover Cream', 'Kem Phục Hồi Ban Đêm'), price: '₫260,000', shopUrl: SHOP },
      { id: 'b10p3', name: L('올인원 에센스', 'All-in-One Essence', 'Tinh Chất All-in-One'), price: '₫240,000', shopUrl: SHOP },
    ],
  },
];

/** 브랜드가 하나도 없을 때만 더미 카탈로그를 심는다. */
export function seedCatalogIfEmpty(): number {
  const { n } = db.prepare(`SELECT COUNT(*) n FROM brands`).get() as { n: number };
  if (n > 0) return 0;

  SEEDS.forEach((seed, bi) => {
    const { products, ...brand } = seed;
    upsertBrand({ ...brand, sortOrder: bi });
    products.forEach((p, pi) => upsertProduct({ ...p, brandId: seed.id, sortOrder: pi }));
  });
  return SEEDS.length;
}
