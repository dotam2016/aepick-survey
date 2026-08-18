import type {
  CareAnswer,
  GameResult,
  LocalFitAnswer,
  RepickAnswer,
  TrendAnswer,
  TrustAnswer,
  ValueAnswer,
  BudgetSlot,
} from './types';
import {
  CARE_CARD_SCORES,
  CARE_SPEED_BONUS,
  CARE_SPEED_BONUS_MS,
  LOCALFIT_MATCH_SCORES,
  LOCALFIT_OPTIMAL,
  REPICK_BASE,
  REPICK_EXPLORE_BONUS,
  TREND_CARDS,
  TREND_EXPERIMENTAL_CARDS,
  TREND_SWIPE_SCORES,
  TRUST_BASE,
  TRUST_CLUE_BONUS,
  VALUE_MAX_PER_SLOT,
  VALUE_TOTAL_COINS,
  VALUE_WEIGHTS,
} from './content';

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/** CORE1 — EMPTY BOTTLE CHALLENGE → Repick */
export function scoreRepick(a: RepickAnswer): GameResult {
  const base = REPICK_BASE[a.picked];
  const fullyViewed = (['A', 'B', 'C'] as const).filter((p) => (a.stagesViewed?.[p] ?? 0) >= 4).length;
  const explored = fullyViewed >= 2;
  const score = clamp(base + (explored ? REPICK_EXPLORE_BONUS : 0));

  let subtype: string;
  if (a.picked === 'B') subtype = 'longterm';
  else if (a.picked === 'C') subtype = 'familiar';
  else subtype = explored ? 'explorer' : 'instant';

  return { score, subtype };
}

/** CORE2 — BEAUTY BUDGET → Value */
export function scoreValue(a: ValueAnswer): GameResult {
  const slots = Object.keys(VALUE_WEIGHTS) as BudgetSlot[];
  const coins = slots.map((s) => a.coins[s] ?? 0);
  const total = coins.reduce((x, y) => x + y, 0);
  if (total !== VALUE_TOTAL_COINS) throw new Error(`coins must total ${VALUE_TOTAL_COINS}, got ${total}`);
  if (coins.some((c) => c < 0 || c > VALUE_MAX_PER_SLOT))
    throw new Error(`each slot must hold 0..${VALUE_MAX_PER_SLOT} coins`);

  const weighted = slots.reduce((sum, s) => sum + (a.coins[s] ?? 0) * VALUE_WEIGHTS[s], 0);
  const score = clamp(Math.round((weighted / VALUE_TOTAL_COINS) * 100));

  const c = (s: BudgetSlot) => a.coins[s] ?? 0;
  const practical = c('effect') + c('price') + c('volume');
  const premium = c('brand') + c('package') + c('ingredient');
  const benefit = c('gift') + c('kol');

  // 복수 충족 시 코인 합이 큰 쪽 (기능정의서 3장)
  const candidates: Array<[string, number, boolean]> = [
    ['practical', practical, practical >= 6],
    ['premium', premium, premium >= 5],
    ['benefit', benefit, benefit >= 4],
  ];
  const qualified = candidates.filter(([, , ok]) => ok).sort((x, y) => y[1] - x[1]);
  const subtype = qualified.length > 0 ? qualified[0][0] : 'balanced';

  return { score, subtype };
}

/** CORE3 — BEAUTY SHIELD → Care */
export function scoreCare(a: CareAnswer): GameResult {
  const picked = a.picked.slice(0, 3);
  const sum = picked.reduce((s, id) => s + (CARE_CARD_SCORES[id] ?? 0), 0);
  const speedBonus = picked.length === 3 && a.elapsedMs <= CARE_SPEED_BONUS_MS ? CARE_SPEED_BONUS : 0;
  const score = clamp(sum + speedBonus);

  // 서브타입: 최고점 카드 계열 기준
  const groups: Record<string, string> = {
    fullIngredients: 'ingredient',
    caution: 'ingredient',
    realTest: 'expert',
    skinType: 'expert',
    bestSeller: 'social',
    celebrity: 'social',
    overclaim: 'social',
    realReviews: 'brand',
  };
  let subtype = 'brand';
  let best = -1;
  for (const id of picked) {
    const v = CARE_CARD_SCORES[id] ?? 0;
    if (v > best) {
      best = v;
      subtype = groups[id] ?? 'brand';
    }
  }
  if (picked.length === 0) subtype = 'social';
  return { score, subtype };
}

/** CORE4 — NEXT BEAUTY WAVE → Trend */
export function scoreTrend(a: TrendAnswer): GameResult {
  const max = TREND_CARDS.length * TREND_SWIPE_SCORES.next; // 96
  let sum = 0;
  let nextCount = 0;
  let notmeCount = 0;
  let experimental = false;
  for (const card of TREND_CARDS) {
    const dir = a.swipes[card];
    if (!dir) throw new Error(`missing swipe for ${card}`);
    sum += TREND_SWIPE_SCORES[dir];
    if (dir === 'next') nextCount++;
    if (dir === 'notme') notmeCount++;
    if (TREND_EXPERIMENTAL_CARDS.includes(card) && dir !== 'notme') experimental = true;
  }
  const score = clamp(Math.round((sum / max) * 100));

  let subtype: string;
  if (nextCount >= 3) subtype = 'pioneer';
  else if (notmeCount >= 3) subtype = 'stable';
  else if (experimental) subtype = 'experimental';
  else subtype = 'mainstream';

  return { score, subtype };
}

/** CORE5 — HANOI BEAUTY WEATHER LAB → Local Fit */
export function scoreLocalFit(a: LocalFitAnswer): GameResult {
  const optimal = LOCALFIT_OPTIMAL[a.scenarioId];
  if (!optimal) throw new Error(`unknown scenario ${a.scenarioId}`);
  const keys = Object.keys(optimal) as (keyof typeof optimal)[];
  const matches = keys.filter((k) => a.choices[k] === optimal[k]).length;
  const score = LOCALFIT_MATCH_SCORES[matches];

  let subtype: string;
  if (matches >= 4) subtype = 'weatherAdaptive';
  else if (a.choices.priority === 'lasting') subtype = 'lasting';
  else if (a.choices.hydration === 'deepMoist' || a.choices.priority === 'comfort') subtype = 'comfort';
  else if (a.choices.size === 'portable' && a.choices.texture === 'light') subtype = 'portable';
  else subtype = 'comfort';

  return { score, subtype };
}

/** CORE6 — REVIEW DETECTIVE → Trust */
export function scoreTrust(a: TrustAnswer): GameResult {
  const base = TRUST_BASE[a.picked];
  const clues = a.cluesViewed?.length ?? 0;
  const score = clamp(base + (clues >= 2 ? TRUST_CLUE_BONUS : 0));

  let subtype: string;
  if (a.picked === 'B') {
    subtype = a.cluesViewed?.includes('B-photo') ? 'media' : 'detail';
  } else if (a.picked === 'A') subtype = 'rating';
  else subtype = 'popularity';

  return { score, subtype };
}
