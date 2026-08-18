import { describe, expect, it } from 'vitest';
import { determinePersona, pairKey, personaPercentile } from '../src/persona';
import { PERSONA_MAP } from '../src/content';
import { AXES, type Axis, type Scores } from '../src/types';

const scores = (partial: Partial<Scores>): Scores => ({
  repick: 50, value: 50, care: 50, trend: 50, localFit: 50, trust: 50,
  ...partial,
});

describe('pairKey', () => {
  it('축 순서와 무관하게 동일 키 생성', () => {
    expect(pairKey('trust', 'value')).toBe('value+trust');
    expect(pairKey('value', 'trust')).toBe('value+trust');
  });
});

describe('PERSONA_MAP 완전성', () => {
  it('15개 축 조합 전체가 매핑되어 있다', () => {
    const pairs: string[] = [];
    for (let i = 0; i < AXES.length; i++)
      for (let j = i + 1; j < AXES.length; j++) pairs.push(`${AXES[i]}+${AXES[j]}`);
    expect(pairs).toHaveLength(15);
    for (const p of pairs) expect(PERSONA_MAP[p], `missing: ${p}`).toBeTruthy();
  });
});

describe('determinePersona', () => {
  it('Repick+Care 최고 → Loyal Glow Keeper', () => {
    const r = determinePersona(scores({ repick: 90, care: 85 }));
    expect(r.personaId).toBe('loyalGlowKeeper');
    expect(r.topAxes).toEqual(['repick', 'care']);
  });
  it('Trend+LocalFit 최고 → Trend Muse', () => {
    expect(determinePersona(scores({ trend: 95, localFit: 80 })).personaId).toBe('trendMuse');
  });
  it('전 축 동점 시 우선순위 Care > Trust → Trust Guardian', () => {
    const r = determinePersona(scores({}));
    expect(r.topAxes).toEqual(['care', 'trust']);
    expect(r.personaId).toBe('trustGuardian');
  });
  it('부분 동점: repick=trend 동점이면 repick 우선', () => {
    const r = determinePersona(scores({ repick: 90, trend: 90, care: 10, trust: 10, value: 10, localFit: 10 }));
    expect(r.topAxes[0]).toBe('repick');
    expect(r.topAxes[1]).toBe('trend');
    expect(r.personaId).toBe('beautyExplorer');
  });
  it('모든 조합에서 예외 없이 페르소나 반환 (전수 검사)', () => {
    for (let i = 0; i < AXES.length; i++) {
      for (let j = 0; j < AXES.length; j++) {
        if (i === j) continue;
        const s = scores({});
        s[AXES[i] as Axis] = 99;
        s[AXES[j] as Axis] = 88;
        const r = determinePersona(s);
        expect(r.personaId).toBeTruthy();
      }
    }
  });
});

describe('personaPercentile', () => {
  it('분포 기반 비율 계산, 최소 1%', () => {
    expect(personaPercentile({ trendMuse: 16, trustGuardian: 84 }, 'trendMuse')).toBe(16);
    expect(personaPercentile({ trendMuse: 0, trustGuardian: 100 }, 'trendMuse')).toBe(1);
    expect(personaPercentile({}, 'trendMuse')).toBe(100);
  });
});
