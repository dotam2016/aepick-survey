import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Axis, GameResult, Language, PersonaId, Scores } from '@aepick/shared';

export type ScreenId =
  | 'attract'
  | 'language'
  | 'consent'
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
  /** 동의 화면에서 입력한 비필수 정보 */
  fullName: string;
  gender: 'male' | 'female' | null;
  ageGroup: string | null;
  results: Partial<Record<Axis, GameResult>>;
  scores: Scores | null;
  persona: PersonaId | null;
  percentile: number;
  resultToken: string | null;
  qrPngUrl: string | null;
  resultUrl: string | null;
  products: { id: string; name: Record<Language, string>; price: string; brandId: string }[];
  offline: boolean; // 백엔드 단절 시 로컬 전용 모드
  bridgeAxis: BridgeKey | null; // 브릿지 화면이 어느 게임 뒤인지 ('final' = 전체 마무리)
}

const initial: SessionState = {
  screen: 'attract',
  language: 'vi',
  sessionId: null,
  visitCount: 1,
  fullName: '',
  gender: null,
  ageGroup: null,
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

export function StateProvider({ children, initialState, freezeNavigation = false }: {
  children: React.ReactNode;
  /** 화면별 목업 상태 주입 — FE 테스트 갤러리 전용. 운영 앱에서는 넘기지 않는다. */
  initialState?: Partial<SessionState>;
  /** true면 go()가 무시된다 — 갤러리에서 자동 화면 전환을 막는 용도 */
  freezeNavigation?: boolean;
}) {
  const seed = useMemo(() => ({ ...initial, ...initialState }), [initialState]);
  const [s, setS] = useState<SessionState>(seed);
  const update = useCallback((patch: Partial<SessionState>) => setS((prev) => {
    // 브릿지 화면은 자동 전환 직전에 bridgeAxis를 비운다.
    // 전환이 잠긴 갤러리에서는 그 초기화까지 무시해야 화면이 빈 채로 남지 않는다.
    if (freezeNavigation && patch.bridgeAxis === null) {
      const { bridgeAxis: _drop, ...rest } = patch;
      return { ...prev, ...rest };
    }
    return { ...prev, ...patch };
  }), [freezeNavigation]);
  const go = useCallback((screen: ScreenId) => {
    if (freezeNavigation) return;
    setS((prev) => ({ ...prev, screen }));
  }, [freezeNavigation]);
  const resetSession = useCallback(() => setS(seed), [seed]);
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
