import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  CARE_TIME_LIMIT_MS,
  SCENARIO_IDS,
  TREND_CARDS,
  VALUE_MAX_PER_SLOT,
  VALUE_TOTAL_COINS,
  VALUE_WEIGHTS,
  scoreCare,
  scoreLocalFit,
  scoreRepick,
  scoreTrend,
  scoreTrust,
  scoreValue,
  type Axis,
  type BudgetSlot,
  type GameAnswer,
  type GameResult,
  type LocalFitChoices,
  type ReviewId,
  type ScenarioId,
  type ShieldCardId,
  type SwipeDir,
  type TrendCardId,
} from '@aepick/shared';
import { BRIDGE_AXES, nextCoreScreen, useStore, type ScreenId } from '../state';
import { makeT, makeTr } from '../i18n';
import { api } from '../api';
import { ASSET, CompleteToast, Deco, ProgressGems } from '../components';

/** 게임 완료 공통 처리: 로컬 채점 → 서버 전송(비동기) → 토스트 → 다음 화면 */
function useGameComplete(screen: ScreenId, axis: Axis) {
  const { s, update, go } = useStore();
  const [toast, setToast] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const complete = (result: GameResult, payload: GameAnswer, message: string) => {
    update({ results: { ...s.results, [axis]: result } });
    if (s.sessionId) {
      api.submitAnswer(s.sessionId, axis, payload);
      api.sendEvent('core.completed', s.sessionId, { coreKey: axis, durationMs: Date.now() - startedAt.current });
    }
    setToast(message);
  };
  /** 완료 토스트가 끝나면 — 브랜드 메시지(브릿지)가 정의된 축이면 먼저 그 화면으로 */
  const advance = () => {
    if (BRIDGE_AXES.includes(axis)) {
      update({ bridgeAxis: axis });
      go('bridge');
      return;
    }
    go(nextCoreScreen(screen));
  };
  return { toast, complete, advance };
}

/** "**...**" 마커를 핑크 강조로 렌더링 */
function AccentText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <span key={i} style={{ color: 'var(--accent)' }}>{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </>
  );
}

function GameShell({ screen, title, question, hint, children, toast, onToastDone }: {
  screen: ScreenId; title: string; question: string; hint?: string;
  children: React.ReactNode; toast: string | null; onToastDone: () => void;
}) {
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: '7%' }}>
      {/* 시안 공통 장식 */}
      <Deco name="dna-helix" style={{ top: '1%', left: '-6%', width: '15%', opacity: 0.75 }} />
      <Deco name="diamond" style={{ top: '0.5%', right: '-3%', width: '13%', animationDelay: '1.4s' }} />
      <Deco name="heart-glossy" style={{ top: '7%', right: '-6%', width: '17%', animationDelay: '2.2s', opacity: 0.75 }} />
      <ProgressGems current={screen} />
      <h2 className="title">{title}</h2>
      <p className="question" style={{ marginTop: 8 }}><AccentText text={question} /></p>
      {hint && <p className="hint" style={{ marginTop: 6 }}>{hint}</p>}
      <div className="game-body">{children}</div>
      {toast && <CompleteToast message={toast} onDone={onToastDone} />}
    </div>
  );
}

/* ────────────── CORE1 제품 이미지 (시안 슬라이스 에셋) ────────────── */

const PRODUCT_ASSET: Record<'A' | 'B' | 'C', string> = {
  A: 'product-serum', B: 'product-cream', C: 'product-lotion',
};
function ProductArt({ id }: { id: 'A' | 'B' | 'C' }) {
  return (
    <img src={ASSET(PRODUCT_ASSET[id])} alt="" draggable={false}
      style={{ width: '100%', display: 'block', borderRadius: 16, pointerEvents: 'none' }} />
  );
}
const PRODUCT_THEMES: Record<'A' | 'B' | 'C', { bg: string; badge: string }> = {
  A: { bg: 'linear-gradient(180deg, #f4ecfe 0%, #e6d4f8 100%)', badge: '#b58ce8' },
  B: { bg: 'linear-gradient(180deg, #fdeef4 0%, #f9d9e5 100%)', badge: '#f0799f' },
  C: { bg: 'linear-gradient(180deg, #fdf6ea 0%, #f4e5cb 100%)', badge: '#d3a968' },
};

/* ────────────── CORE 1. EMPTY BOTTLE CHALLENGE ────────────── */

export function Core1Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const tr = makeTr(s.language);
  const { toast, complete, advance } = useGameComplete('core1', 'repick');
  const [open, setOpen] = useState<'A' | 'B' | 'C' | null>(null);
  const [stage, setStage] = useState(0);
  const [viewed, setViewed] = useState<Record<'A' | 'B' | 'C', number>>({ A: 0, B: 0, C: 0 });
  const stageLabels = tr<string[]>('core1.stageLabels');
  const zoneRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false); // 드래그 직후 클릭 오발동 방지

  const openProduct = (p: 'A' | 'B' | 'C') => { setOpen(p); setStage(0); markViewed(p, 1); };
  const markViewed = (p: 'A' | 'B' | 'C', n: number) =>
    setViewed((v) => ({ ...v, [p]: Math.max(v[p], n) }));

  const pick = (p: 'A' | 'B' | 'C') => {
    const payload = { picked: p, stagesViewed: viewed };
    const result = scoreRepick(payload);
    complete(result, payload, t(`core1.complete.${result.subtype}`));
  };

  /**
   * 드롭 판정: 포인터가 REPICK 존 안에서 놓였거나, 카드를 아래로 충분히 끌었으면 선택.
   * (포인터 좌표만으로 판정하면 스냅백·터치 보정 때문에 놓치는 경우가 있어 이동량을 함께 본다)
   */
  const onDragEnd = (p: 'A' | 'B' | 'C', point: { x: number; y: number }, offsetY: number) => {
    setTimeout(() => { dragging.current = false; }, 80);
    const zone = zoneRef.current?.getBoundingClientRect();
    const inZone = !!zone && point.x >= zone.left && point.x <= zone.right
      && point.y >= zone.top - 24 && point.y <= zone.bottom + 24;
    if (inZone || offsetY > 90) pick(p);
  };

  return (
    <GameShell screen="core1" title={t('core1.title')} question={t('core1.question')} hint={t('core1.hint')}
      toast={toast} onToastDone={advance}>
      {/* 제품 카드 3장 (시안: 스테이지 배지 + 일러스트 + 이름 + 스토리 보기) */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        {(['A', 'B', 'C'] as const).map((p, idx) => {
          const theme = PRODUCT_THEMES[p];
          return (
            <motion.div key={p} drag dragSnapToOrigin dragMomentum={false} whileDrag={{ scale: 1.08, zIndex: 50 }}
              onDragStart={() => { dragging.current = true; }}
              onDragEnd={(_, info) => onDragEnd(p, info.point, info.offset.y)}
              style={{
                flex: 1, padding: '14px 8px 12px', cursor: 'grab', textAlign: 'center',
                borderRadius: 24, background: theme.bg, position: 'relative',
                border: '2px solid rgba(255,255,255,0.85)',
                boxShadow: '0 10px 26px rgba(242,92,124,0.16)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}
              onClick={() => { if (!dragging.current) openProduct(p); }}>
              {/* 스테이지 배지 */}
              <div style={{
                padding: '4px 14px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: '#fff',
                background: theme.badge, boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
              }}>{stageLabels[idx]}</div>
              <ProductArt id={p} />
              <div style={{ fontWeight: 800, fontSize: 'clamp(12px, 1.7vh, 15px)', color: 'var(--ink)', lineHeight: 1.25 }}>
                {t(`core1.products.${p}.name`)}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: 700,
                color: viewed[p] > 0 ? 'var(--accent)' : 'var(--ink-dim)',
              }}>
                {viewed[p] > 0 ? `${viewed[p]}/4 ✓` : <>{t('core1.tapStory')} ›</>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* TAP / SWIPE 힌트 */}
      <p style={{ fontSize: 'clamp(12px, 1.6vh, 15px)', fontWeight: 700, color: 'var(--ink-dim)', letterSpacing: '0.14em' }}>
        👆 TAP / SWIPE
      </p>

      {/* REPICK 드롭존 (시안: 점선 대시 + 글로시 핑크) */}
      <div ref={zoneRef} style={{
        width: '100%', minHeight: '15vh', display: 'grid', placeItems: 'center',
        borderRadius: 30, border: '2.5px dashed rgba(242,92,124,0.65)',
        background: 'linear-gradient(180deg, rgba(250,180,199,0.28), rgba(242,92,124,0.16))',
        boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.6), 0 8px 22px rgba(242,92,124,0.12)',
        position: 'relative',
      }}>
        <span className="sparkle" style={{ top: 10, left: 16, fontSize: 14 }}>✦</span>
        <span className="sparkle" style={{ bottom: 10, right: 18, fontSize: 12 }}>✧</span>
        <div style={{ fontWeight: 900, fontSize: 'clamp(22px, 3.2vh, 30px)', letterSpacing: '0.3em', color: 'var(--accent)', textIndent: '0.3em' }}>
          ↓ {t('core1.repickZone')}
        </div>
      </div>

      {/* 푸터 넛지 (건너뛰기 없음 — 모든 축 데이터를 수집해야 DNA가 완성된다) */}
      <p style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'var(--accent)' }}>
        ✦ {t('core1.footerNudge')}
      </p>

      <AnimatePresence>
        {open && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}>
            <motion.div className="modal card" initial={{ y: 60 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 140, borderRadius: 20, overflow: 'hidden', background: PRODUCT_THEMES[open].bg }}>
                <ProductArt id={open} />
              </div>
              <h1 style={{ fontSize: 22 }}>{t(`core1.products.${open}.name`)}</h1>
              <p className="hint" style={{ color: 'var(--gold)', fontWeight: 700 }}>{stageLabels[stage]}</p>
              <p style={{ fontSize: 17, lineHeight: 1.5, minHeight: 78 }}>{t(`core1.products.${open}.stage${stage + 1}`)}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {stage < 3 ? (
                  <button className="btn small" onClick={() => { setStage(stage + 1); markViewed(open, stage + 2); }}>
                    {t('common.next')} →
                  </button>
                ) : (
                  <>
                    {/* 드래그 대안 입력 (접근성·키오스크 안정성) */}
                    <button className="btn small" onClick={() => { const p = open; setOpen(null); pick(p); }}>
                      ♥ {t('core1.repickZone')}!
                    </button>
                    <button className="btn ghost small" onClick={() => setOpen(null)}>{t('common.done')}</button>
                  </>
                )}
                <button className="btn ghost small" onClick={() => setOpen(null)}>✕</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  );
}

/* ────────────── CORE 2. BEAUTY BUDGET ────────────── */

export function Core2Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const { toast, complete, advance } = useGameComplete('core2', 'value');
  const [coins, setCoins] = useState<Record<BudgetSlot, number>>({
    effect: 0, ingredient: 0, price: 0, volume: 0, gift: 0, brand: 0, package: 0, kol: 0,
  });
  const used = Object.values(coins).reduce((a, b) => a + b, 0);
  const remaining = VALUE_TOTAL_COINS - used;

  const add = (slot: BudgetSlot) => {
    if (remaining <= 0 || coins[slot] >= VALUE_MAX_PER_SLOT) return;
    setCoins((c) => ({ ...c, [slot]: c[slot] + 1 }));
  };
  const remove = (slot: BudgetSlot) => {
    if (coins[slot] <= 0) return;
    setCoins((c) => ({ ...c, [slot]: c[slot] - 1 }));
  };

  const done = () => {
    const payload = { coins };
    const result = scoreValue(payload);
    complete(result, payload, t(`core2.complete.${result.subtype}`));
  };

  const slots = Object.keys(VALUE_WEIGHTS) as BudgetSlot[];

  return (
    <GameShell screen="core2" title={t('core2.title')} question={t('core2.question')} hint={t('core2.hint')}
      toast={toast} onToastDone={advance}>
      {/* 잔여 코인 패널 (시안: 흰 캡슐 안에 코인 나열 + 남은 개수) */}
      <div style={{
        width: '100%', padding: '12px 18px', borderRadius: 999,
        background: 'linear-gradient(180deg, #fff, #fdf3f6)',
        border: '1.5px solid rgba(255,255,255,0.9)',
        boxShadow: '0 8px 22px rgba(242,92,124,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }}>
          {Array.from({ length: VALUE_TOTAL_COINS }).map((_, i) => (
            <motion.img key={i} src={ASSET('coin')} alt="" layout
              animate={{ opacity: i < remaining ? 1 : 0.18, scale: i < remaining ? 1 : 0.85 }}
              style={{ width: 'min(30px, 8.5%)', height: 'auto', flex: 'none' }} />
          ))}
        </div>
        <span style={{ fontSize: 'clamp(12px, 1.8vh, 16px)', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
          {t('core2.remaining', { n: remaining })}
        </span>
      </div>

      <div className="slot-grid">
        {slots.map((slot) => (
          <div key={slot} className="card slot" style={{ opacity: remaining === 0 && coins[slot] === 0 ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <button className="btn ghost" style={{ width: 40, height: 34, minHeight: 34, minWidth: 40, padding: 0, flex: 'none', fontSize: 19, borderRadius: 12, color: 'var(--accent)', background: '#fdf1f4' }}
                onClick={() => remove(slot)}>−</button>
              <span style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap', fontSize: 'clamp(15px, 2.2vh, 20px)', fontWeight: 800 }}>
                {t(`core2.slots.${slot}`)}
              </span>
              <button className="btn ghost" style={{ width: 40, height: 34, minHeight: 34, minWidth: 40, padding: 0, flex: 'none', fontSize: 19, borderRadius: 12, color: 'var(--accent)', background: '#fdf1f4' }}
                onClick={() => add(slot)}>＋</button>
            </div>
            {/* 코인 홀더 4칸 — 시안처럼 빈 칸도 항상 표시 */}
            <div className="coins-row">
              {Array.from({ length: VALUE_MAX_PER_SLOT }).map((_, i) =>
                i < coins[slot] ? (
                  <motion.img key={i} src={ASSET('coin')} alt="" layout initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{ width: 22, height: 22 }} />
                ) : (
                  <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: '#f4e7eb' }} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <button className="btn" style={{ width: '86%', padding: '20px 0' }} disabled={remaining !== 0} onClick={done}>
        {t('common.done')}
      </button>
      <p style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'var(--accent)' }}>
        ✦ {t('core2.footerNudge')} ✦
      </p>
    </GameShell>
  );
}

/* ────────────── CORE 3. BEAUTY SHIELD ────────────── */

const SHIELD_CARDS: ShieldCardId[] = [
  'fullIngredients', 'celebrity', 'skinType', 'bestSeller',
  'realTest', 'overclaim', 'caution', 'realReviews',
];

export function Core3Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const { toast, complete, advance } = useGameComplete('core3', 'care');
  const [picked, setPicked] = useState<ShieldCardId[]>([]);
  const [timeLeft, setTimeLeft] = useState(CARE_TIME_LIMIT_MS / 1000);
  const [running, setRunning] = useState(true);
  const startAt = useRef(Date.now());
  const pickedAt = useRef<number | null>(null); // 3장 선택 완료 시각 (채점용)
  const finished = useRef(false);
  // 타이머 콜백에서 최신 선택을 읽기 위한 ref
  // (setState updater 안에서 finish를 호출하면 React 18에서 부작용이 유실된다)
  const pickedRef = useRef<ShieldCardId[]>([]);

  const finish = (final: ShieldCardId[]) => {
    if (finished.current) return;
    finished.current = true;
    setRunning(false);
    const payload = { picked: final, elapsedMs: (pickedAt.current ?? Date.now()) - startAt.current };
    const result = scoreCare(payload);
    complete(result, payload, t(`core3.complete.${result.subtype}`));
  };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remain = CARE_TIME_LIMIT_MS - (Date.now() - startAt.current);
      setTimeLeft(Math.max(0, Math.ceil(remain / 1000)));
      if (remain <= 0) {
        clearInterval(id);
        setRunning(false); // 시간 종료 — 진행은 '다음' 버튼으로
      }
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  const tap = (id: ShieldCardId) => {
    if (finished.current || !running || picked.includes(id)) return;
    const next = [...picked, id];
    setPicked(next);
    pickedRef.current = next;
    if (next.length === 3) {
      // 3장 선택 시 타이머 정지 — 진행은 '다음' 버튼으로 (시안)
      pickedAt.current = Date.now();
      setRunning(false);
    }
  };

  // 3장을 채웠거나 제한 시간이 끝나면 진행 가능 (시간 초과 시 선택분만 채점)
  const canProceed = picked.length === 3 || !running;

  return (
    <GameShell screen="core3" title={t('core3.title')} question={t('core3.question')} hint={t('core3.hint')}
      toast={toast} onToastDone={advance}>
      {/* 방패 히어로 + 타이머 캡슐 */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={ASSET('shield-hero')} alt="" style={{ width: 'clamp(120px, 17vh, 170px)', height: 'auto' }} />
        <div style={{
          marginTop: -12, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 24px', borderRadius: 999,
          background: 'linear-gradient(180deg, #fff, #fdf3f6)', border: '1.5px solid rgba(255,255,255,0.9)',
          boxShadow: '0 8px 22px rgba(242,92,124,0.16)',
        }}>
          <span style={{
            fontSize: 'clamp(24px, 3.6vh, 34px)', fontWeight: 900, minWidth: 34, textAlign: 'center',
            color: timeLeft <= 3 && running ? 'var(--accent-deep)' : 'var(--accent)',
          }}>{timeLeft}</span>
          <span style={{ fontSize: 22, color: 'var(--accent)', opacity: 0.55 }}>🛡</span>
          <div style={{ display: 'flex', gap: 7 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 15, height: 15, borderRadius: '50%', transition: 'all 0.3s',
                background: picked.length > i ? 'linear-gradient(180deg, #fa93ad, var(--accent-deep))' : '#f4e7eb',
                boxShadow: picked.length > i ? '0 2px 6px rgba(242,92,124,0.45)' : 'none',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* 신호 카드 8종 */}
      <div className="shield-grid">
        {SHIELD_CARDS.map((id) => {
          const isPicked = picked.includes(id);
          // 주의: 위험 신호 카드를 시각적으로 구분하지 않는다.
          // 미리 딤드 처리하면 정답을 알려주는 셈이라 게임이 성립하지 않는다.
          return (
            <button key={id} onClick={() => tap(id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
              borderRadius: 20, cursor: 'pointer', font: 'inherit', textAlign: 'left',
              transition: 'all 0.2s',
              background: isPicked ? 'linear-gradient(180deg, #fde3ea, #f9c4d5)' : '#fff',
              border: isPicked ? '2px solid rgba(242,92,124,0.55)' : '1.5px solid var(--card-border)',
              boxShadow: isPicked ? '0 8px 20px rgba(242,92,124,0.25)' : '0 4px 12px rgba(242,92,124,0.08)',
            }}>
              <img src={ASSET(`sh-${id}`)} alt="" draggable={false} style={{ width: 38, height: 38, flex: 'none' }} />
              <span style={{
                flex: 1, fontSize: 'clamp(13px, 1.9vh, 17px)', fontWeight: 700, lineHeight: 1.25, color: 'var(--ink)',
              }}>{t(`core3.cards.${id}`)}</span>
              <span style={{
                width: 24, height: 24, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: isPicked ? 'linear-gradient(180deg, #fa93ad, var(--accent-deep))' : 'transparent',
                border: isPicked ? 'none' : '1.5px solid #e9d3d9',
                color: '#fff', fontSize: 13, fontWeight: 900,
                boxShadow: isPicked ? '0 2px 6px rgba(242,92,124,0.4)' : 'none',
              }}>{isPicked ? '✓' : ''}</span>
            </button>
          );
        })}
      </div>

      {/* 하단 넛지 + 다음 버튼 */}
      <p style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'var(--accent)' }}>
        🛡 {t('core3.footerNudge')}
      </p>
      <button className="btn" style={{ width: '86%', padding: '20px 0' }} disabled={!canProceed}
        onClick={() => finish(pickedRef.current)}>
        {t('common.next')} ›
      </button>
    </GameShell>
  );
}

/* ────────────── CORE 4. NEXT BEAUTY WAVE ────────────── */

export function Core4Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const { toast, complete, advance } = useGameComplete('core4', 'trend');
  const [idx, setIdx] = useState(0);
  const [swipes, setSwipes] = useState<Partial<Record<TrendCardId, SwipeDir>>>({});
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);

  const card = TREND_CARDS[idx];

  const swipe = (dir: SwipeDir) => {
    const next = { ...swipes, [card]: dir };
    setSwipes(next);
    if (idx === TREND_CARDS.length - 1) {
      const payload = { swipes: next as Record<TrendCardId, SwipeDir> };
      const result = scoreTrend(payload);
      complete(result, payload, t(`core4.complete.${result.subtype}`));
    } else {
      setIdx(idx + 1);
      x.set(0); y.set(0);
    }
  };

  const onDragEnd = () => {
    const dx = x.get();
    const dy = y.get();
    if (dy < -110 && Math.abs(dy) > Math.abs(dx)) swipe('next');
    else if (dx > 110) swipe('love');
    else if (dx < -110) swipe('notme');
  };

  /** 좌우 스와이프 안내 (원형 버튼 + 점선) */
  const SideHint = ({ dir }: { dir: 'notme' | 'love' }) => (
    <div style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      [dir === 'notme' ? 'left' : 'right']: 0, zIndex: 3,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: 'rgba(255,255,255,0.55)', border: '1.5px solid rgba(242,92,124,0.3)',
        color: dir === 'notme' ? 'var(--ink-dim)' : 'var(--accent)', fontSize: 20, fontWeight: 800,
      }}>{dir === 'notme' ? '←' : '→'}</div>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: dir === 'notme' ? 'var(--ink-dim)' : 'var(--accent)' }}>
        {t(`core4.dirs.${dir}`)}
      </span>
    </div>
  );

  return (
    <GameShell screen="core4" title={t('core4.title')} question={t('core4.question')} hint={t('core4.hint')}
      toast={toast} onToastDone={advance}>
      <div className="swipe-area" style={{ minHeight: '46vh', marginTop: '2.5vh' }}>
        <SideHint dir="notme" />
        <SideHint dir="love" />
        {/* 뒤에 쌓인 카드 그림자 */}
        <div style={{ position: 'absolute', inset: '5% 13%', borderRadius: 30, background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.7)', transform: 'scale(0.97) translateY(8px)' }} />
        <AnimatePresence mode="popLayout">
          <motion.div key={card} drag dragSnapToOrigin onDragEnd={onDragEnd}
            style={{
              position: 'absolute', inset: '2% 11%', x, y, rotate, zIndex: 2,
              borderRadius: 30, overflow: 'hidden', cursor: 'grab',
              background: 'linear-gradient(180deg, #fdeef3, #fbdfe8)',
              border: '3px solid rgba(255,255,255,0.9)',
              boxShadow: '0 18px 46px rgba(242,92,124,0.35), 0 0 0 6px rgba(255,255,255,0.35)',
              display: 'flex', flexDirection: 'column',
            }}
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 0.85 }}>
            {/* 인물 이미지 */}
            <img src={ASSET(`trend-${card}`)} alt="" style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'cover', objectPosition: 'top center' }} />
            {/* TREND 배지 */}
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 20px', borderRadius: 999, whiteSpace: 'nowrap',
              background: 'linear-gradient(180deg, #fa93ad, var(--accent-deep))', color: '#fff',
              fontSize: 12.5, fontWeight: 800, letterSpacing: '0.06em',
              boxShadow: '0 4px 10px rgba(242,92,124,0.35)',
            }}>{t('core4.trendBadge', { n: idx + 1 })}</div>
            {/* 스타일 정보 */}
            <div style={{ flex: 'none', padding: '10px 14px 14px', background: 'linear-gradient(180deg, rgba(253,238,243,0.8), #fdeef3 45%)', textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(22px, 3.2vh, 32px)', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                {t(`core4.styles.${card}.name`)}
              </div>
              <div style={{ fontSize: 'clamp(12px, 1.7vh, 15px)', marginTop: 4, fontWeight: 600, color: 'var(--ink)' }}>
                {t(`core4.styles.${card}.desc`)}
              </div>
              <div style={{
                display: 'inline-block', marginTop: 8, padding: '3px 16px', borderRadius: 999,
                background: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700, color: 'var(--accent)',
              }}>{idx + 1} / {TREND_CARDS.length}</div>
            </div>
            {/* 드래그 방향 배지 */}
            <motion.div className="dir-badge" style={{ left: 18, color: '#c9707f', borderColor: '#c9707f', opacity: useTransform(x, [-140, -40], [1, 0]) }}>
              {t('core4.dirs.notme')}
            </motion.div>
            <motion.div className="dir-badge" style={{ right: 18, color: 'var(--accent-deep)', borderColor: 'var(--accent-deep)', opacity: useTransform(x, [40, 140], [0, 1]) }}>
              {t('core4.dirs.love')} ♥
            </motion.div>
            <motion.div className="dir-badge" style={{ left: '50%', translateX: '-50%', color: '#e8a33f', borderColor: '#e8a33f', opacity: useTransform(y, [-140, -40], [1, 0]) }}>
              ↑
            </motion.div>
          </motion.div>
        </AnimatePresence>
        {/* 상단 ↑ 방향 배지 + 라벨 (위로 스와이프 = 다음에 해볼래요) */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -100%)', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,0.92)', border: '2px solid rgba(242,92,124,0.35)',
            color: 'var(--accent)', fontSize: 19, fontWeight: 900,
            boxShadow: '0 4px 14px rgba(242,92,124,0.25)',
          }}>↑</div>
        </div>
      </div>

      {/* 하단 3버튼 — 화살표(방향) + 라벨 2줄 구성 */}
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        {([
          { dir: 'notme' as SwipeDir, arrow: '←', primary: false },
          { dir: 'next' as SwipeDir, arrow: '↑', primary: false },
          { dir: 'love' as SwipeDir, arrow: '→', primary: true },
        ]).map((b) => (
          <button key={b.dir} className={`btn${b.primary ? '' : ' ghost'}`}
            style={{
              flex: 1, padding: '12px 4px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, lineHeight: 1.2,
            }}
            onClick={() => swipe(b.dir)}>
            <span style={{ fontSize: 'clamp(15px, 2.1vh, 19px)', fontWeight: 900 }}>{b.arrow}</span>
            {b.dir !== 'next' && (
              <span style={{ fontSize: 'clamp(11px, 1.6vh, 14px)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                {t(`core4.dirs.${b.dir}`)}
              </span>
            )}
          </button>
        ))}
      </div>
    </GameShell>
  );
}

/* ────────────── CORE 5. HANOI BEAUTY WEATHER LAB ────────────── */

const SCENARIO_EMOJI: Record<ScenarioId, string> = {
  'hanoi-humid': '🌡', 'rainy-commute': '🌧', 'outdoor-date': '☀️',
  'aircon-office': '❄️', 'weekend-trip': '🎒', 'evening-party': '🌙',
};
/** 시안에서 확보된 상황 사진 (그 외 시나리오는 그라디언트+이모지로 폴백) */
const SCENARIO_PHOTO: Partial<Record<ScenarioId, string>> = { 'rainy-commute': 'scenario-rainy' };
const SCENARIO_TINT: Record<ScenarioId, string> = {
  'hanoi-humid': 'linear-gradient(160deg,#ffd9a8,#ffb37a)',
  'rainy-commute': 'linear-gradient(160deg,#b9c8e8,#8fa3cc)',
  'outdoor-date': 'linear-gradient(160deg,#ffe9a8,#ffc46b)',
  'aircon-office': 'linear-gradient(160deg,#cfe9f5,#9fd0e8)',
  'weekend-trip': 'linear-gradient(160deg,#d3edc6,#a3d68f)',
  'evening-party': 'linear-gradient(160deg,#d5c2ef,#a98edb)',
};

export function Core5Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const tr = makeTr(s.language);
  const { toast, complete, advance } = useGameComplete('core5', 'localFit');
  const scenarioId = useMemo<ScenarioId>(
    () => SCENARIO_IDS[Math.floor(Math.random() * SCENARIO_IDS.length)], []);
  const [choices, setChoices] = useState<Partial<LocalFitChoices>>({});
  const [gauge, setGauge] = useState<number | null>(null);
  const [lastSubtype, setLastSubtype] = useState<string | null>(null);

  const pairs: { key: keyof LocalFitChoices; options: [string, string] }[] = [
    { key: 'texture', options: ['light', 'rich'] },
    { key: 'finish', options: ['matte', 'glow'] },
    { key: 'priority', options: ['lasting', 'comfort'] },
    { key: 'hydration', options: ['deepMoist', 'fastAbsorb'] },
    { key: 'size', options: ['portable', 'jumbo'] },
  ];
  const allChosen = pairs.every((p) => choices[p.key]);

  const done = () => {
    const payload = { scenarioId, choices: choices as LocalFitChoices };
    const result = scoreLocalFit(payload);
    setGauge(result.score);
    setLastSubtype(result.subtype);
    setTimeout(() => complete(result, payload, t(`core5.complete.${result.subtype}`)), 1800);
  };

  const chips = tr<string[]>(`core5.chips.${scenarioId}`) ?? [];
  const photo = SCENARIO_PHOTO[scenarioId];

  return (
    <GameShell screen="core5" title={t('core5.title')} question={t('core5.question')} hint={t('core5.hint')}
      toast={toast} onToastDone={advance}>
      {/* 시나리오 카드: 상황 사진 + 제목 + 날씨 아이콘 + 속성 칩 */}
      <div className="card" style={{ width: '100%', padding: 12, display: 'flex', gap: 12, borderRadius: 28 }}>
        <div style={{
          width: '30%', flex: 'none', borderRadius: 20, overflow: 'hidden', minHeight: 92,
          background: SCENARIO_TINT[scenarioId], display: 'grid', placeItems: 'center', fontSize: 38,
        }}>
          {photo
            ? <img src={ASSET(photo)} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : SCENARIO_EMOJI[scenarioId]}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <p style={{ flex: 1, textAlign: 'left', fontWeight: 800, fontSize: 'clamp(13px, 1.9vh, 17px)', lineHeight: 1.35 }}>
              {t(`core5.scenarios.${scenarioId}`)}
            </p>
            <img src={ASSET('weather-rain')} alt="" draggable={false} style={{ width: 44, height: 'auto', flex: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {chips.map((c) => (
              <span key={c} style={{
                padding: '4px 10px', borderRadius: 999, background: '#fdf1f4',
                border: '1px solid var(--card-border)', fontSize: 'clamp(10px, 1.4vh, 12.5px)',
                fontWeight: 700, color: 'var(--ink-dim)', whiteSpace: 'nowrap',
              }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 속성 5쌍 — 좌우 대결(VS) 구조로 한 쌍임을 명확히 표시 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {pairs.map((p, idx) => {
          const decided = !!choices[p.key];
          return (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              padding: '7px 8px', borderRadius: 26,
              background: decided ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.8)',
              border: `1.5px solid ${decided ? 'rgba(242,92,124,0.3)' : 'var(--card-border)'}`,
              transition: 'all 0.2s',
            }}>
              {p.options.map((opt, oi) => {
                const on = choices[p.key] === opt;
                return (
                  <React.Fragment key={opt}>
                    {oi === 1 && (
                      <span style={{
                        flex: 'none', width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        background: '#fff', border: '1.5px solid rgba(242,92,124,0.35)',
                        fontSize: 11, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.02em',
                      }}>VS</span>
                    )}
                    <button className={`pair-btn ${on ? 'on' : ''}`}
                      style={{
                        cursor: 'pointer', gap: 8, borderRadius: 20,
                        background: on ? undefined : '#fff',
                        border: on ? 'none' : '1px solid var(--card-border)',
                        boxShadow: on ? undefined : 'none',
                        justifyContent: 'center',
                      }}
                      onClick={() => setChoices((c) => ({ ...c, [p.key]: opt }))}>
                      <span className="attr-icon" style={{
                        WebkitMaskImage: `url(${ASSET(`attr-${opt}`)})`,
                        maskImage: `url(${ASSET(`attr-${opt}`)})`,
                      }} />
                      <span>{t(`core5.attributes.${p.key}.${opt}`)}</span>
                    </button>
                  </React.Fragment>
                );
              })}
              <span style={{
                flex: 'none', width: 22, textAlign: 'center', fontSize: 11, fontWeight: 800,
                color: decided ? 'var(--accent)' : 'rgba(96,58,72,0.35)',
              }}>{decided ? '✓' : idx + 1}</span>
            </div>
          );
        })}
      </div>

      {/* 적합도 패널 (시안: 상시 노출, 완료 시 게이지 채워짐) */}
      <div className="card" style={{ width: '100%', padding: '12px 16px', borderRadius: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={ASSET('fit-heart')} alt="" draggable={false} style={{ width: 62, height: 'auto', flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ fontSize: 'clamp(12px, 1.7vh, 15px)', fontWeight: 800, color: 'var(--ink)' }}>
            {t('core5.gauge')} <span style={{ color: 'var(--accent)' }}>✦</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1, height: 16, borderRadius: 999, background: '#f7e7ec', overflow: 'hidden' }}>
              <div className="fill-anim" style={{
                height: '100%', width: `${gauge ?? 0}%`, borderRadius: 999,
                background: 'linear-gradient(90deg, #fa93ad, var(--accent-deep))',
              }} />
            </div>
            <span style={{ fontSize: 'clamp(18px, 2.6vh, 26px)', fontWeight: 900, color: 'var(--accent)', minWidth: 54, textAlign: 'right' }}>
              {gauge !== null ? `${gauge}%` : '—'}
            </span>
          </div>
          <p className="hint" style={{ fontSize: 'clamp(11px, 1.5vh, 13px)', marginTop: 4 }}>
            {gauge !== null ? t(`core5.complete.${lastSubtype ?? 'weatherAdaptive'}`) : t('core5.fitReady')}
          </p>
        </div>
      </div>

      <button className="btn" style={{ width: '86%', padding: '20px 0' }} disabled={!allChosen || gauge !== null} onClick={done}>
        {t('common.done')} ›
      </button>
      <p style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'var(--accent)' }}>
        ♡ {t('core5.footerNudge')}
      </p>
    </GameShell>
  );
}

/* ────────────── CORE 6. REVIEW DETECTIVE ────────────── */

/** 단서 ID — 공유 스코어링의 'B-photo' 판정과 일치해야 함 */
const CLUE_IDS: Record<ReviewId, [string, string]> = {
  A: ['A-rating', 'A-verify'],
  B: ['B-detail', 'B-photo'],
  C: ['C-likes', 'C-info'],
};

export function Core6Screen() {
  const { s } = useStore();
  const t = makeT(s.language);
  const { toast, complete, advance } = useGameComplete('core6', 'trust');
  const [cluesViewed, setCluesViewed] = useState<string[]>([]);
  const [picked, setPicked] = useState<ReviewId | null>(null);

  const viewClue = (id: string) =>
    setCluesViewed((c) => (c.includes(id) ? c : [...c, id]));

  const choose = (r: ReviewId) => {
    if (picked) return;
    setPicked(r);
    const payload = { picked: r, cluesViewed };
    const result = scoreTrust(payload);
    setTimeout(() => complete(result, payload, t(`core6.complete.${result.subtype}`)), 500);
  };

  return (
    <GameShell screen="core6" title={t('core6.title')} question={t('core6.question')} hint={t('core6.hint')}
      toast={toast} onToastDone={advance}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        {(['A', 'B', 'C'] as ReviewId[]).map((r) => (
          <div key={r} className={`card review-card ${picked === r ? 'picked' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>"{t(`core6.reviews.${r}.text`)}"</span>
            </div>
            <div className="hint" style={{ fontSize: 13, marginTop: 8 }}>{t(`core6.reviews.${r}.meta`)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {(['clue1', 'clue2'] as const).map((c, i) => {
                const id = CLUE_IDS[r][i];
                const seen = cluesViewed.includes(id);
                return (
                  <button key={id} className={`clue-chip ${seen ? 'viewed' : ''}`} style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => viewClue(id)}>
                    🔍 {seen ? t(`core6.reviews.${r}.${c}`) : '?'}
                  </button>
                );
              })}
              <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => choose(r)}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </GameShell>
  );
}
