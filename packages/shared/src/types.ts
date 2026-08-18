/** Beauty DNA 6축 */
export const AXES = ['repick', 'value', 'care', 'trend', 'localFit', 'trust'] as const;
export type Axis = (typeof AXES)[number];

export type Scores = Record<Axis, number>;

export type Language = 'vi' | 'en' | 'ko';
export type Mood = 'soft' | 'bright' | 'chic';

export type PersonaId =
  | 'loyalGlowKeeper'
  | 'smartBeautyCurator'
  | 'trendMuse'
  | 'localBeautyExpert'
  | 'trustGuardian'
  | 'beautyExplorer';

export interface PersonaProfile {
  id: PersonaId;
  name: string; // 영문 고유명 (번역하지 않음)
  primaryColor: string;
  secondaryColor: string;
  mood: string;
}

/** 게임별 답변 payload */
export interface RepickAnswer {
  picked: 'A' | 'B' | 'C';
  stagesViewed: Record<'A' | 'B' | 'C', number>; // 제품별 열람한 단계 수 (0~4)
  durationMs?: number;
}

export type BudgetSlot =
  | 'effect'
  | 'ingredient'
  | 'price'
  | 'volume'
  | 'gift'
  | 'brand'
  | 'package'
  | 'kol';

export interface ValueAnswer {
  coins: Record<BudgetSlot, number>; // 합계 10, 슬롯당 최대 4
  durationMs?: number;
}

export type ShieldCardId =
  | 'fullIngredients'
  | 'realTest'
  | 'caution'
  | 'skinType'
  | 'realReviews'
  | 'bestSeller'
  | 'celebrity'
  | 'overclaim';

export interface CareAnswer {
  picked: ShieldCardId[]; // 최대 3장 (시간 초과 시 0~2장)
  elapsedMs: number;
}

export type TrendCardId =
  | 'glassSkin'
  | 'softMatte'
  | 'naturalPeach'
  | 'boldColor'
  | 'minimalSkin'
  | 'y2k';

export type SwipeDir = 'love' | 'next' | 'notme';

export interface TrendAnswer {
  swipes: Record<TrendCardId, SwipeDir>;
}

export type ScenarioId =
  | 'hanoi-humid'
  | 'rainy-commute'
  | 'outdoor-date'
  | 'aircon-office'
  | 'weekend-trip'
  | 'evening-party';

export type AttributeKey = 'texture' | 'finish' | 'priority' | 'hydration' | 'size';

export interface LocalFitChoices {
  texture: 'light' | 'rich';
  finish: 'matte' | 'glow';
  priority: 'lasting' | 'comfort';
  hydration: 'deepMoist' | 'fastAbsorb';
  size: 'portable' | 'jumbo';
}

export interface LocalFitAnswer {
  scenarioId: ScenarioId;
  choices: LocalFitChoices;
}

export type ReviewId = 'A' | 'B' | 'C';

export interface TrustAnswer {
  picked: ReviewId;
  cluesViewed: string[]; // 확대해 본 단서 ID 목록
  durationMs?: number;
}

export type CoreKey = Axis;

export type GameAnswer =
  | RepickAnswer
  | ValueAnswer
  | CareAnswer
  | TrendAnswer
  | LocalFitAnswer
  | TrustAnswer;

export interface GameResult {
  score: number; // 0~100
  subtype: string; // 결과 문구 키
}

export interface PersonaResult {
  personaId: PersonaId;
  topAxes: [Axis, Axis];
}

/** 세션 (서버·클라이언트 공유) */
export interface Consents {
  terms: boolean;
  photo: boolean;
  storage: boolean;
  analytics: boolean;
  marketing: boolean;
}

export type ImageStatus = 'queued' | 'processing' | 'completed' | 'failed_fallback';

export interface ResultData {
  persona: PersonaId;
  nickname: string;
  scores: Scores;
  keywords: string[];
  images: { story916: string; feed45: string; plain: string; card: string };
  products: RecommendedProduct[];
  coupon: string;
  expiresAt: string;
}

export interface RecommendedProduct {
  id: string;
  name: Record<Language, string>;
  category: string;
  reasonKey: string;
  shopUrl: string;
}
