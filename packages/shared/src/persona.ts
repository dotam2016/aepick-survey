import type { Axis, PersonaId, PersonaResult, Scores } from './types';
import { AXES } from './types';
import { AXIS_TIE_PRIORITY, PERSONA_MAP } from './content';

/**
 * 상위 2축 조합 키 생성.
 * AXES 정의 순서(repick,value,care,trend,localFit,trust)로 정렬해 "a+b" 형태로 만든다.
 */
export function pairKey(a: Axis, b: Axis): string {
  const sorted = [a, b].sort((x, y) => AXES.indexOf(x) - AXES.indexOf(y));
  return `${sorted[0]}+${sorted[1]}`;
}

/**
 * 페르소나 판정 (기능정의서 4.1)
 * 1) 점수 내림차순 상위 2축 선정
 * 2) 동점 시 AXIS_TIE_PRIORITY(care > trust > repick > localFit > value > trend) 우선
 * 3) 15조합 매핑 테이블로 확정
 */
export function determinePersona(scores: Scores): PersonaResult {
  const ranked = [...AXES].sort((a, b) => {
    const diff = scores[b] - scores[a];
    if (diff !== 0) return diff;
    return AXIS_TIE_PRIORITY.indexOf(a) - AXIS_TIE_PRIORITY.indexOf(b);
  });
  const topAxes: [Axis, Axis] = [ranked[0], ranked[1]];
  const personaId = PERSONA_MAP[pairKey(topAxes[0], topAxes[1])];
  if (!personaId) throw new Error(`no persona mapping for ${pairKey(topAxes[0], topAxes[1])}`);
  return { personaId, topAxes };
}

/** 전체 분포 대비 희소성(%) 계산 — 결과 화면 "오늘 참여자 중 {p}%" */
export function personaPercentile(personaCounts: Record<string, number>, persona: PersonaId): number {
  const total = Object.values(personaCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return 100;
  const mine = personaCounts[persona] ?? 0;
  return Math.max(1, Math.round((mine / total) * 100));
}
