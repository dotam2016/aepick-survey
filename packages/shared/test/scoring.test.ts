import { describe, expect, it } from 'vitest';
import {
  scoreCare,
  scoreLocalFit,
  scoreRepick,
  scoreTrend,
  scoreTrust,
  scoreValue,
} from '../src/scoring';
import type { TrendAnswer, ValueAnswer } from '../src/types';

describe('CORE1 scoreRepick', () => {
  it('B 선택 = 장기 효용 90점', () => {
    const r = scoreRepick({ picked: 'B', stagesViewed: { A: 1, B: 4, C: 0 } });
    expect(r).toEqual({ score: 90, subtype: 'longterm' });
  });
  it('탐색 보너스: 2개 제품 이상 4단계 완독 시 +8, 상한 100', () => {
    const r = scoreRepick({ picked: 'B', stagesViewed: { A: 4, B: 4, C: 0 } });
    expect(r.score).toBe(98);
    const capped = scoreRepick({ picked: 'B', stagesViewed: { A: 4, B: 4, C: 4 } });
    expect(capped.score).toBe(98); // 90+8, 100 미만이므로 그대로
  });
  it('A 선택: 완독 여부에 따라 explorer/instant 분기', () => {
    expect(scoreRepick({ picked: 'A', stagesViewed: { A: 4, B: 4, C: 1 } }).subtype).toBe('explorer');
    expect(scoreRepick({ picked: 'A', stagesViewed: { A: 2, B: 0, C: 0 } }).subtype).toBe('instant');
  });
  it('C 선택 = familiar 72점', () => {
    const r = scoreRepick({ picked: 'C', stagesViewed: { A: 0, B: 0, C: 4 } });
    expect(r).toEqual({ score: 72, subtype: 'familiar' });
  });
});

describe('CORE2 scoreValue', () => {
  const coins = (partial: Partial<ValueAnswer['coins']>): ValueAnswer['coins'] => ({
    effect: 0, ingredient: 0, price: 0, volume: 0, gift: 0, brand: 0, package: 0, kol: 0,
    ...partial,
  });

  it('합리성 최대 배분(효과4+가격4+성분2) → 고득점', () => {
    const r = scoreValue({ coins: coins({ effect: 4, price: 4, ingredient: 2 }) });
    expect(r.score).toBe(98); // (4+4+1.8)/10*100
    expect(r.subtype).toBe('practical');
  });
  it('KOL·패키지 위주 배분 → 저득점', () => {
    const r = scoreValue({ coins: coins({ kol: 4, package: 4, gift: 2 }) });
    expect(r.score).toBe(30); // (0.8+1.2+1.0)/10*100
  });
  it('합계 10 미만/초과, 슬롯 4개 초과 시 오류', () => {
    expect(() => scoreValue({ coins: coins({ effect: 4 }) })).toThrow();
    expect(() => scoreValue({ coins: coins({ effect: 4, price: 4, brand: 4 }) })).toThrow(); // 12개
  });
  it('서브타입: 프리미엄(브랜드+패키지+성분 ≥5)', () => {
    const r = scoreValue({ coins: coins({ brand: 3, ingredient: 3, effect: 2, price: 2 }) });
    expect(r.subtype).toBe('premium'); // premium 6 ≥5, practical 4 <6
  });
  it('서브타입: 혜택형(사은품+KOL ≥4, 타 조건 미충족)', () => {
    const r = scoreValue({ coins: coins({ gift: 3, kol: 2, effect: 3, price: 2 }) });
    expect(r.subtype).toBe('benefit'); // benefit 5 ≥4, practical 5 <6
  });
  it('복수 충족 시 코인 합이 큰 쪽 우선', () => {
    const r = scoreValue({ coins: coins({ gift: 2, kol: 2, effect: 3, price: 3 }) });
    expect(r.subtype).toBe('practical'); // practical 6 > benefit 4
  });
  it('서브타입: 균형형', () => {
    const r = scoreValue({ coins: coins({ effect: 2, ingredient: 2, price: 1, volume: 1, gift: 1, brand: 1, package: 1, kol: 1 }) });
    expect(r.subtype).toBe('balanced');
  });
});

describe('CORE3 scoreCare', () => {
  it('최고 신뢰 3장 + 속도 보너스 = 100', () => {
    const r = scoreCare({ picked: ['fullIngredients', 'realTest', 'caution'], elapsedMs: 6000 });
    expect(r.score).toBe(100); // 33+33+30=96 +4
    expect(r.subtype).toBe('ingredient');
  });
  it('속도 보너스 없음(7초 초과)', () => {
    const r = scoreCare({ picked: ['fullIngredients', 'realTest', 'caution'], elapsedMs: 9000 });
    expect(r.score).toBe(96);
  });
  it('약한 신호 포함 시 감점 효과', () => {
    const r = scoreCare({ picked: ['celebrity', 'bestSeller', 'overclaim'], elapsedMs: 5000 });
    expect(r.score).toBe(24); // 8+12+0 +4
    expect(r.subtype).toBe('social');
  });
  it('시간 초과로 2장만 선택', () => {
    const r = scoreCare({ picked: ['fullIngredients', 'skinType'], elapsedMs: 10000 });
    expect(r.score).toBe(61); // 33+28, 보너스 없음(3장 미만)
  });
});

describe('CORE4 scoreTrend', () => {
  const swipes = (dirs: TrendAnswer['swipes']) => scoreTrend({ swipes: dirs });

  it('전부 NEXT = 100', () => {
    const r = swipes({ glassSkin: 'next', softMatte: 'next', naturalPeach: 'next', boldColor: 'next', minimalSkin: 'next', y2k: 'next' });
    expect(r.score).toBe(100);
    expect(r.subtype).toBe('pioneer');
  });
  it('전부 NOT ME = 최저 12점, 안정적 취향', () => {
    const r = swipes({ glassSkin: 'notme', softMatte: 'notme', naturalPeach: 'notme', boldColor: 'notme', minimalSkin: 'notme', y2k: 'notme' });
    expect(r.score).toBe(13); // 12/96*100 = 12.5 → round 13
    expect(r.subtype).toBe('stable');
  });
  it('Bold/Y2K 수용 시 실험적 스타일형', () => {
    const r = swipes({ glassSkin: 'love', softMatte: 'love', naturalPeach: 'notme', boldColor: 'love', minimalSkin: 'notme', y2k: 'love' });
    expect(r.subtype).toBe('experimental');
  });
  it('무난한 LOVE 위주 = 대중 공감형', () => {
    const r = swipes({ glassSkin: 'love', softMatte: 'love', naturalPeach: 'love', boldColor: 'notme', minimalSkin: 'love', y2k: 'notme' });
    expect(r.subtype).toBe('mainstream');
  });
});

describe('CORE5 scoreLocalFit', () => {
  it('완벽 일치 = 100, 날씨 적응형', () => {
    const r = scoreLocalFit({
      scenarioId: 'hanoi-humid',
      choices: { texture: 'light', finish: 'matte', priority: 'lasting', hydration: 'fastAbsorb', size: 'portable' },
    });
    expect(r).toEqual({ score: 100, subtype: 'weatherAdaptive' });
  });
  it('전부 불일치 = 30', () => {
    const r = scoreLocalFit({
      scenarioId: 'hanoi-humid',
      choices: { texture: 'rich', finish: 'glow', priority: 'comfort', hydration: 'deepMoist', size: 'jumbo' },
    });
    expect(r.score).toBe(30);
    expect(r.subtype).toBe('comfort');
  });
  it('3개 일치 = 70', () => {
    const r = scoreLocalFit({
      scenarioId: 'aircon-office',
      choices: { texture: 'rich', finish: 'glow', priority: 'comfort', hydration: 'fastAbsorb', size: 'portable' },
    });
    expect(r.score).toBe(70);
  });
});

describe('CORE6 scoreTrust', () => {
  it('B + 단서 2개 = 100', () => {
    const r = scoreTrust({ picked: 'B', cluesViewed: ['B-photo', 'A-rating'] });
    expect(r.score).toBe(100);
    expect(r.subtype).toBe('media'); // 사진 단서 확인
  });
  it('B, 단서 미확인 = 92, detail', () => {
    const r = scoreTrust({ picked: 'B', cluesViewed: [] });
    expect(r).toEqual({ score: 92, subtype: 'detail' });
  });
  it('A = rating, C = popularity', () => {
    expect(scoreTrust({ picked: 'A', cluesViewed: [] })).toEqual({ score: 48, subtype: 'rating' });
    expect(scoreTrust({ picked: 'C', cluesViewed: [] })).toEqual({ score: 42, subtype: 'popularity' });
  });
});
