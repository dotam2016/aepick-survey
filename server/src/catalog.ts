import { db, now } from './db.js';
import type { Axis, Language, PersonaId } from '@aepick/shared';

/**
 * ─────────────────────────────────────────────────────────────
 *  브랜드·제품 카탈로그
 * ─────────────────────────────────────────────────────────────
 *
 * v1에서는 코드 상수(brands.ts / products.ts)였으나, 운영자가 어드민에서
 * 직접 입력·수정해야 하므로 DB로 옮겼다. 코드 배포 없이 바꿀 수 있다.
 *
 * 최초 기동 시 팝업 운영 규모에 맞춰 10개 브랜드를 더미로 심는다.
 * 실제 입점 브랜드가 확정되면 어드민에서 교체한다(시드는 다시 돌지 않는다).
 *
 *  personaTags  : 이 브랜드를 우선 추천할 DNA 유형
 *  axisAffinity : 6축 중 이 브랜드가 강한 축 (0~1)
 */

export interface CatalogProduct {
  id: string;
  brandId: string;
  name: Record<Language, string>;
  price: string;
  shopUrl: string;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface CatalogBrand {
  id: string;
  name: string;
  tagline: Record<Language, string>;
  emoji: string;
  logoUrl: string | null;
  personaTags: PersonaId[];
  axisAffinity: Partial<Record<Axis, number>>;
  sortOrder: number;
  active: boolean;
  products: CatalogProduct[];
}

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

interface BrandRow {
  id: string; name: string; tagline: string | null; emoji: string | null; logo_url: string | null;
  persona_tags: string | null; axis_affinity: string | null; sort_order: number; active: number;
}
interface ProductRow {
  id: string; brand_id: string; name: string; price: string | null; shop_url: string | null;
  image_url: string | null; sort_order: number; active: number;
}

function toBrand(r: BrandRow, products: CatalogProduct[]): CatalogBrand {
  return {
    id: r.id,
    name: r.name,
    tagline: parse(r.tagline, { ko: '', en: '', vi: '' } as Record<Language, string>),
    emoji: r.emoji ?? '🏷',
    logoUrl: r.logo_url,
    personaTags: parse(r.persona_tags, [] as PersonaId[]),
    axisAffinity: parse(r.axis_affinity, {} as Partial<Record<Axis, number>>),
    sortOrder: r.sort_order,
    active: r.active === 1,
    products,
  };
}

function toProduct(r: ProductRow): CatalogProduct {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: parse(r.name, { ko: '', en: '', vi: '' } as Record<Language, string>),
    price: r.price ?? '',
    shopUrl: r.shop_url ?? '',
    imageUrl: r.image_url,
    sortOrder: r.sort_order,
    active: r.active === 1,
  };
}

/** 전체 카탈로그. onlyActive=false 면 비활성 항목도 포함(어드민용). */
export function listBrands(onlyActive = true): CatalogBrand[] {
  const brands = db.prepare(
    `SELECT * FROM brands ${onlyActive ? 'WHERE active=1' : ''} ORDER BY sort_order, name`,
  ).all() as unknown as BrandRow[];
  const products = db.prepare(
    `SELECT * FROM brand_products ${onlyActive ? 'WHERE active=1' : ''} ORDER BY sort_order, id`,
  ).all() as unknown as ProductRow[];

  const byBrand = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    const list = byBrand.get(p.brand_id) ?? [];
    list.push(toProduct(p));
    byBrand.set(p.brand_id, list);
  }
  return brands.map((b) => toBrand(b, byBrand.get(b.id) ?? []));
}

export function getBrand(id: string): CatalogBrand | undefined {
  const row = db.prepare(`SELECT * FROM brands WHERE id=?`).get(id) as unknown as BrandRow | undefined;
  if (!row) return undefined;
  const products = (db.prepare(`SELECT * FROM brand_products WHERE brand_id=? ORDER BY sort_order, id`)
    .all(id) as unknown as ProductRow[]).map(toProduct);
  return toBrand(row, products);
}

export interface BrandInput {
  id: string;
  name: string;
  tagline?: Record<string, string>;
  emoji?: string;
  logoUrl?: string | null;
  personaTags?: string[];
  axisAffinity?: Record<string, number>;
  sortOrder?: number;
  active?: boolean;
}

export function upsertBrand(input: BrandInput): CatalogBrand | undefined {
  db.prepare(
    `INSERT INTO brands (id, name, tagline, emoji, logo_url, persona_tags, axis_affinity, sort_order, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, tagline=excluded.tagline, emoji=excluded.emoji, logo_url=excluded.logo_url,
       persona_tags=excluded.persona_tags, axis_affinity=excluded.axis_affinity,
       sort_order=excluded.sort_order, active=excluded.active, updated_at=excluded.updated_at`,
  ).run(
    input.id, input.name,
    JSON.stringify(input.tagline ?? {}), input.emoji ?? '🏷', input.logoUrl ?? null,
    JSON.stringify(input.personaTags ?? []), JSON.stringify(input.axisAffinity ?? {}),
    input.sortOrder ?? 0, input.active === false ? 0 : 1, now(),
  );
  return getBrand(input.id);
}

export interface ProductInput {
  id: string;
  brandId: string;
  name?: Record<string, string>;
  price?: string;
  shopUrl?: string;
  imageUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export function upsertProduct(input: ProductInput): CatalogProduct | undefined {
  db.prepare(
    `INSERT INTO brand_products (id, brand_id, name, price, shop_url, image_url, sort_order, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       brand_id=excluded.brand_id, name=excluded.name, price=excluded.price, shop_url=excluded.shop_url,
       image_url=excluded.image_url, sort_order=excluded.sort_order, active=excluded.active,
       updated_at=excluded.updated_at`,
  ).run(
    input.id, input.brandId, JSON.stringify(input.name ?? {}), input.price ?? '',
    input.shopUrl ?? '', input.imageUrl ?? null, input.sortOrder ?? 0,
    input.active === false ? 0 : 1, now(),
  );
  const row = db.prepare(`SELECT * FROM brand_products WHERE id=?`).get(input.id) as unknown as ProductRow | undefined;
  return row ? toProduct(row) : undefined;
}

export function deleteBrand(id: string): boolean {
  db.prepare(`DELETE FROM brand_products WHERE brand_id=?`).run(id);
  return Number(db.prepare(`DELETE FROM brands WHERE id=?`).run(id).changes) > 0;
}

export function deleteProduct(id: string): boolean {
  return Number(db.prepare(`DELETE FROM brand_products WHERE id=?`).run(id).changes) > 0;
}

/** 추천 브랜드 수 (스펙: 3~5) */
export const BRAND_PICK_COUNT = 4;

/** 페르소나 태그 우선 → 상위 2축 친화도 순으로 브랜드 선정 */
export function recommendBrands(persona: PersonaId, topAxes: [Axis, Axis], count = BRAND_PICK_COUNT): CatalogBrand[] {
  const scored = listBrands(true).map((b) => {
    const tagBonus = b.personaTags.includes(persona) ? 10 : 0;
    const affinity = (b.axisAffinity[topAxes[0]] ?? 0) * 1.4 + (b.axisAffinity[topAxes[1]] ?? 0);
    return { b, score: tagBonus + affinity };
  });
  return scored.sort((x, y) => y.score - x.score).slice(0, count).map((x) => x.b);
}

/** 추천 브랜드에서 대표 제품을 뽑아 평평하게 편다 (결과 화면 제품 목록용) */
export function recommendProducts(brands: CatalogBrand[], perBrand = 1, max = 5): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  for (const b of brands) {
    for (const p of b.products.slice(0, perBrand)) {
      if (out.length < max) out.push(p);
    }
  }
  return out;
}
