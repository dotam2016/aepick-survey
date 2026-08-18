import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Axis, GameResult, Language, PersonaId, Scores } from '@aepick/shared';

export type ScreenId =
  | 'attract'
  | 'language'
  | 'intro'
  | 'core1'
  | 'core2'
  | 'core3'
  | 'core4'
  | 'core5'
  | 'core6'
  | 'bridge'
  | 'analyzing'
  | 'dnaResult'
  | 'qr'
  | 'end';

export interface SessionState {
  screen: ScreenId;
  language: Language;
  sessionId: string | null;
  /** app 계정 기준 몇 번째 방문인지. 첫 방문은 1. */
  visitCount: number;
  results: Partial<Record<Axis, GameResult>>;
  scores: Scores | null;
  persona: PersonaId | null;
  percentile: number;
  resultToken: string | null;
  qrPngUrl: string | null;
  resultUrl: string | null;
  products: { id: string; name: Record<Language, string>; category: string; reasonKey: string }[];
  offline: boolean; // 백엔드 단절 시 로컬 전용 모드
  bridgeAxis: BridgeKey | null; // 브릿지 화면이 어느 게임 뒤인지 ('final' = 전체 마무리)
}

const initial: SessionState = {
  screen: 'attract',
  language: 'vi',
  sessionId: null,
  visitCount: 1,
  results: {},
  scores: null,
  persona: null,
  percentile: 100,
  resultToken: null,
  qrPngUrl: null,
  resultUrl: null,
  products: [],
  offline: false,
  bridgeAxis: null,
};

interface Store {
  s: SessionState;
  update: (patch: Partial<SessionState>) => void;
  go: (screen: ScreenId) => void;
  resetSession: () => void;
}

const Ctx = createContext<Store>(null as unknown as Store);

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SessionState>(initial);
  const update = useCallback((patch: Partial<SessionState>) => setS((prev) => ({ ...prev, ...patch })), []);
  const go = useCallback((screen: ScreenId) => setS((prev) => ({ ...prev, screen })), []);
  const resetSession = useCallback(() => setS(initial), []);
  const store = useMemo(() => ({ s, update, go, resetSession }), [s, update, go, resetSession]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/** 게임 화면 순서 */
export const CORE_ORDER: { screen: ScreenId; axis: Axis }[] = [
  { screen: 'core1', axis: 'repick' },
  { screen: 'core2', axis: 'value' },
  { screen: 'core3', axis: 'care' },
  { screen: 'core4', axis: 'trend' },
  { screen: 'core5', axis: 'localFit' },
  { screen: 'core6', axis: 'trust' },
];

export function nextCoreScreen(current: ScreenId): ScreenId {
  const idx = CORE_ORDER.findIndex((c) => c.screen === current);
  return idx >= 0 && idx < CORE_ORDER.length - 1 ? CORE_ORDER[idx + 1].screen : 'analyzing';
}

/**
 * 게임 사이에 삽입되는 브랜드 메시지(브릿지) 화면.
 * 각 게임 뒤에 해당 축의 브랜드 메시지가 나온 뒤 다음 게임으로 넘어간다.
 * 마지막 게임(trust) 뒤에는 곧바로 DNA 분석으로 진행한다.
 * 이미지: assets/ui/bridge-<axis>.jpg
 */
export type BridgeKey = Axis;
export const BRIDGE_AXES: Axis[] = ['repick', 'value', 'care', 'trend', 'localFit', 'trust'];

/** 브릿지 화면이 끝난 뒤 이동할 곳 */
export function screenAfterBridge(key: BridgeKey | null): ScreenId {
  const cur = CORE_ORDER.find((c) => c.axis === key);
  return cur ? nextCoreScreen(cur.screen) : 'analyzing';
}
