import type {
  BudgetSlot,
  PersonaId,
  PersonaProfile,
  ScenarioId,
  ShieldCardId,
  TrendCardId,
  LocalFitChoices,
  Axis,
} from './types';

/** CORE1 — 제품별 기본 점수 (기능정의서 3장) */
export const REPICK_BASE: Record<'A' | 'B' | 'C', number> = { A: 45, B: 90, C: 72 };
export const REPICK_EXPLORE_BONUS = 8; // 2개 이상 제품 4단계 완독 시

/** CORE2 — 슬롯별 합리성 가중치 */
export const VALUE_WEIGHTS: Record<BudgetSlot, number> = {
  effect: 1.0,
  ingredient: 0.9,
  price: 1.0,
  volume: 0.8,
  gift: 0.5,
  brand: 0.4,
  package: 0.3,
  kol: 0.2,
};
export const VALUE_TOTAL_COINS = 10;
export const VALUE_MAX_PER_SLOT = 4;

/** CORE3 — 카드별 점수 */
export const CARE_CARD_SCORES: Record<ShieldCardId, number> = {
  fullIngredients: 33,
  realTest: 33,
  caution: 30,
  skinType: 28,
  realReviews: 25,
  bestSeller: 12,
  celebrity: 8,
  overclaim: 0,
};
export const CARE_TIME_LIMIT_MS = 10_000;
export const CARE_SPEED_BONUS_MS = 7_000;
export const CARE_SPEED_BONUS = 4;
/** 위험/약한 신호 카드 (선택 시 부드러운 안내) */
export const CARE_WEAK_CARDS: ShieldCardId[] = ['bestSeller', 'celebrity', 'overclaim'];

/** CORE4 — 스와이프 점수 */
export const TREND_SWIPE_SCORES = { next: 16, love: 12, notme: 2 } as const;
export const TREND_CARDS: TrendCardId[] = [
  'glassSkin',
  'softMatte',
  'naturalPeach',
  'boldColor',
  'minimalSkin',
  'y2k',
];
export const TREND_EXPERIMENTAL_CARDS: TrendCardId[] = ['boldColor', 'y2k'];

/** CORE5 — 상황별 최적 조합 */
export const LOCALFIT_OPTIMAL: Record<ScenarioId, LocalFitChoices> = {
  'hanoi-humid': { texture: 'light', finish: 'matte', priority: 'lasting', hydration: 'fastAbsorb', size: 'portable' },
  'rainy-commute': { texture: 'light', finish: 'matte', priority: 'lasting', hydration: 'fastAbsorb', size: 'portable' },
  'outdoor-date': { texture: 'light', finish: 'glow', priority: 'lasting', hydration: 'fastAbsorb', size: 'portable' },
  'aircon-office': { texture: 'rich', finish: 'glow', priority: 'comfort', hydration: 'deepMoist', size: 'jumbo' },
  'weekend-trip': { texture: 'light', finish: 'matte', priority: 'lasting', hydration: 'fastAbsorb', size: 'portable' },
  'evening-party': { texture: 'rich', finish: 'glow', priority: 'lasting', hydration: 'deepMoist', size: 'portable' },
};
/** 일치 개수 → 점수 */
export const LOCALFIT_MATCH_SCORES = [30, 42, 55, 70, 86, 100] as const;
export const SCENARIO_IDS = Object.keys(LOCALFIT_OPTIMAL) as ScenarioId[];

/** CORE6 — 리뷰 기본 점수 */
export const TRUST_BASE: Record<'A' | 'B' | 'C', number> = { A: 48, B: 92, C: 42 };
export const TRUST_CLUE_BONUS = 8; // 단서 2개 이상 확인 시

/** 페르소나 프로필 */
export const PERSONAS: Record<PersonaId, PersonaProfile> = {
  loyalGlowKeeper: {
    id: 'loyalGlowKeeper',
    name: 'Loyal Glow Keeper',
    primaryColor: '#E8B84B',
    secondaryColor: '#F5EFE0',
    mood: 'Calm & Warm',
  },
  smartBeautyCurator: {
    id: 'smartBeautyCurator',
    name: 'Smart Beauty Curator',
    primaryColor: '#2456C8',
    secondaryColor: '#C9CED6',
    mood: 'Sharp & Clean',
  },
  trendMuse: {
    id: 'trendMuse',
    name: 'Trend Muse',
    primaryColor: '#FF6F91',
    secondaryColor: '#8A2BE2',
    mood: 'Confident & Playful',
  },
  localBeautyExpert: {
    id: 'localBeautyExpert',
    name: 'Local Beauty Expert',
    primaryColor: '#5DBB63',
    secondaryColor: '#FFD54F',
    mood: 'Natural & Easy',
  },
  trustGuardian: {
    id: 'trustGuardian',
    name: 'Trust Guardian',
    primaryColor: '#4FD1C5',
    secondaryColor: '#F8F6F0',
    mood: 'Pure & Secure',
  },
  beautyExplorer: {
    id: 'beautyExplorer',
    name: 'Beauty Explorer',
    primaryColor: '#FF8C42',
    secondaryColor: '#0F6466',
    mood: 'Bold & Free',
  },
};

/**
 * 상위 2축 조합 → 페르소나 매핑 (15조합 전체, 기능정의서 4.2)
 * 키는 AXES 순서(repick,value,care,trend,localFit,trust)로 정렬해 조합
 */
export const PERSONA_MAP: Record<string, PersonaId> = {
  'repick+care': 'loyalGlowKeeper',
  'repick+trust': 'loyalGlowKeeper',
  'value+trust': 'smartBeautyCurator',
  'repick+value': 'smartBeautyCurator',
  'trend+localFit': 'trendMuse',
  'value+trend': 'trendMuse',
  'trend+trust': 'trendMuse',
  'value+localFit': 'localBeautyExpert',
  'repick+localFit': 'localBeautyExpert',
  'localFit+trust': 'localBeautyExpert',
  'care+trust': 'trustGuardian',
  'value+care': 'trustGuardian',
  'care+localFit': 'trustGuardian',
  'repick+trend': 'beautyExplorer',
  'care+trend': 'beautyExplorer',
};

/** 동점 시 축 우선순위 (기능정의서 4.1) */
export const AXIS_TIE_PRIORITY: Axis[] = ['care', 'trust', 'repick', 'localFit', 'value', 'trend'];

/** 축별 이미지 모티프 (템플릿 합성용) */
export const AXIS_MOTIFS: Record<Axis, string> = {
  repick: 'orbit', // 반복 리본·원형 궤도
  value: 'geometry', // 정돈된 기하학
  care: 'shield', // 투명 보호막·수분 텍스처
  trend: 'neon', // 네온 웨이브
  localFit: 'hanoi', // 하노이 빛·도시 무드
  trust: 'stars', // 별빛·인증 패턴
};
