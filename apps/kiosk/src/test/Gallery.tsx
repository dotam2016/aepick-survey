/**
 * ─────────────────────────────────────────────────────────────
 *  AEPICK — FE TEST GALLERY (bản Test FE)
 * ─────────────────────────────────────────────────────────────
 *
 * 운영 앱과 똑같은 컴포넌트를 목업 상태로 렌더링한다.
 * 화면 파일(flow.tsx·games.tsx·styles.css)을 고치면 저장하는 즉시 여기에 반영된다.
 *
 * 비율 유지 방법: 실제 키오스크는 `height:100dvh; aspect-ratio:10/16`이고
 * 글자 크기가 vh 기준(clamp(…,3.3vh,…))이다. 그래서 무대를 "브라우저 높이 그대로"
 * 그린 뒤 transform:scale()로 줄인다 — 축소해도 비율이 실제 PAD와 같다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@aepick/shared';
import { StateProvider, useStore } from '../state';
import { SCREENS as APP_SCREENS } from '../App';
import { ASSET } from '../components';
import { GROUPS, GROUP_LABEL, SCREENS, showsHeader, type Group, type ScreenEntry } from './registry';
import { TONES, toneCss, toneVars, type Tone } from './tones';
import './gallery.css';

const LANGS: { code: Language; label: string }[] = [
  { code: 'vi', label: 'VI' },
  { code: 'en', label: 'EN' },
  { code: 'ko', label: 'KO' },
];

/** 화면별 기기 크기 */
const DEVICE_SIZE = { phone: { w: 390, h: 844 }, desktop: { w: 1440, h: 900 } };

const STAGE_RATIO = 10 / 16; // 키오스크 세로형 비율
const THUMB_W = 200;

/** 배경 톤 선택값 저장 키. 기본은 "코드 그대로"라 옛 값이 남아 코드 변경을 가리지 않는다 */
const TONE_KEY = 'feTestTone.v2';
const SOURCE = 'source';

function useViewport() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

/**
 * 배경 톤 미리보기 적용.
 *
 * tone이 null이면 아무것도 덮어쓰지 않는다 = styles.css에 적힌 실제 값을 그대로 본다.
 * (기본값이 이것이어야 한다. 특정 톤을 강제로 얹어 두면 코드에서 톤을 바꿔도
 *  갤러리에는 옛날 톤이 계속 보여 "바뀐 게 없다"고 오해하게 된다.)
 *
 * --bg-stage 안의 var()는 그 변수가 선언된 :root에서 값이 확정되므로,
 * 무대 엘리먼트가 아니라 :root(html)에 얹어야 톤이 실제로 바뀐다.
 */
function useToneVars(tone: Tone | null) {
  useEffect(() => {
    if (!tone) return;
    const root = document.documentElement.style;
    const vars = toneVars(tone);
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    return () => { for (const k of Object.keys(vars)) root.removeProperty(k); };
  }, [tone]);
}

/** 무대가 놓일 영역의 실제 크기 — 툴바·메타바 높이를 상수로 두지 않고 직접 잰다 */
function useBoxSize(ref: React.RefObject<HTMLElement>) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

/** 그리드에서 화면에 들어올 때만 실제로 렌더링한다 (30개를 한꺼번에 돌리지 않도록) */
function Lazy({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShown(true)),
      { rootMargin: '260px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return <div ref={ref} style={{ height }}>{shown ? children : <div className="tf-ph" />}</div>;
}

/* ────────────────────── 키오스크 화면 프레임 ────────────────────── */

/**
 * 무대 내용.
 * - 기본(잠금): 고른 화면 하나만 그대로 보여 준다.
 * - "Tự chuyển màn"(자동 전환): 실제 앱처럼 state.screen을 따라가며 흐름을 재생한다.
 */
function StageBody({ entry, autoplay }: { entry: ScreenEntry; autoplay: boolean }) {
  const { s } = useStore();
  const Comp = autoplay ? (APP_SCREENS[s.screen] ?? entry.Comp!) : entry.Comp!;
  const header = autoplay
    ? s.screen !== 'attract' && s.screen !== 'intro'
    : showsHeader(entry);
  return (
    <>
      {header && <img src={ASSET('logo')} alt="aépick" className="brand-header" />}
      <Comp />
    </>
  );
}

function KioskFrame({ entry, lang, autoplay, scale, replay }: {
  entry: ScreenEntry; lang: Language; autoplay: boolean; scale: number; replay: number; tone: Tone | null;
}) {
  const { h } = useViewport();
  const stageH = h;
  const stageW = Math.round(h * STAGE_RATIO);
  // 배경 톤은 :root에 얹는다 (useToneVars) — --bg-stage 안의 var()가 :root에서 확정되기 때문
  return (
    <div className="tf-frame" style={{ width: stageW * scale, height: stageH * scale }}>
      <div className="tf-stage" style={{ width: stageW, height: stageH, transform: `scale(${scale})` }}>
        <StateProvider
          key={`${entry.id}|${lang}|${autoplay}|${replay}`}
          initialState={{ ...entry.state, language: lang }}
          freezeNavigation={!autoplay}
        >
          <StageBody entry={entry} autoplay={autoplay} />
        </StateProvider>
      </div>
    </div>
  );
}

/* ────────────────────── 웹 페이지 프레임 (iframe) ────────────────────── */

function WebFrame({ entry, lang, scale, replay, tone }: {
  entry: ScreenEntry; lang: Language; scale: number; replay: number; tone: Tone | null;
}) {
  const { w, h } = DEVICE_SIZE[entry.device ?? 'phone'];
  // tone이 없으면(=코드 그대로) 페이지 자신의 CSS를 그대로 쓴다
  const bg = tone ? `&bg=${tone.id}` : '';
  return (
    <div className="tf-frame" style={{ width: w * scale, height: h * scale }}>
      <iframe
        key={`${entry.id}|${lang}|${tone?.id ?? 'src'}|${replay}`}
        title={entry.label}
        src={`${entry.path}?lang=${lang}${bg}`}
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      />
    </div>
  );
}

function Frame(props: {
  entry: ScreenEntry; lang: Language; autoplay: boolean; scale: number; replay: number; tone: Tone | null;
}) {
  return props.entry.kind === 'web' ? <WebFrame {...props} /> : <KioskFrame {...props} />;
}

/* ────────────────────── 갤러리 ────────────────────── */

export default function Gallery() {
  const vp = useViewport();
  const viewRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(viewRef);
  const [view, setView] = useState<'single' | 'grid'>(() =>
    location.hash.startsWith('#grid') ? 'grid' : 'single');
  const [selected, setSelected] = useState<string>(() => {
    const fromHash = location.hash.replace(/^#\/?/, '').replace(/^grid\/?/, '');
    return SCREENS.some((s) => s.id === fromHash) ? fromHash : SCREENS[0].id;
  });
  const [lang, setLang] = useState<Language>('vi');
  const [zoom, setZoom] = useState(100);
  const [autoplay, setAutoplay] = useState(false);
  const [replay, setReplay] = useState(0);
  const [filter, setFilter] = useState('');
  /** 'source' = styles.css에 적힌 값 그대로 (기본). 그 외에는 후보 톤 미리보기 */
  const [toneId, setToneId] = useState<string>(() => localStorage.getItem(TONE_KEY) ?? SOURCE);
  const tone = useMemo(() => TONES.find((t) => t.id === toneId) ?? null, [toneId]);
  const [copied, setCopied] = useState(false);
  useToneVars(tone);

  const pickTone = (id: string) => {
    setToneId(id);
    localStorage.setItem(TONE_KEY, id);
    setCopied(false);
  };
  /** 지금 보이는 톤을 styles.css에 붙여 넣을 수 있게 클립보드로 */
  const copyToneCss = async () => {
    const css = tone ? toneCss(tone) : (() => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      return `:root {\n  --bg-0: ${v('--bg-0')};\n  --bg-1: ${v('--bg-1')};\n`
        + `  --bg-glow-a: ${v('--bg-glow-a')};\n  --bg-glow-b: ${v('--bg-glow-b')};\n}`;
    })();
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { window.prompt('Copy CSS:', css); }
  };

  const entry = useMemo(() => SCREENS.find((s) => s.id === selected) ?? SCREENS[0], [selected]);

  useEffect(() => {
    location.hash = view === 'grid' ? `#grid/${selected}` : `#/${selected}`;
  }, [view, selected]);

  useEffect(() => { document.title = `FE TEST · ${entry.label}`; }, [entry]);

  /* ← → 키로 화면 이동 */
  const move = useCallback((dir: 1 | -1) => {
    const i = SCREENS.findIndex((s) => s.id === selected);
    setSelected(SCREENS[(i + dir + SCREENS.length) % SCREENS.length].id);
  }, [selected]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [move]);

  /** 화면의 실제 픽셀 크기 — 키오스크는 "브라우저 높이 = PAD 높이"가 기준이다 */
  const naturalSize = (e: ScreenEntry) =>
    e.kind === 'web' ? DEVICE_SIZE[e.device ?? 'phone'] : { w: vp.h * STAGE_RATIO, h: vp.h };

  /** 단일 보기 배율 — 남은 영역에 맞춘 뒤 줌 비율을 곱한다 */
  const fitScale = (e: ScreenEntry) => {
    const n = naturalSize(e);
    const availH = box.h || vp.h * 0.7;
    const availW = box.w || vp.w - 300;
    return Math.min(availH / n.h, availW / n.w) * (zoom / 100);
  };
  /** 그리드 썸네일 배율 */
  const thumbScale = (e: ScreenEntry) => THUMB_W / naturalSize(e).w;

  const visible = SCREENS.filter((s) =>
    !filter.trim() ||
    (s.label + ' ' + (s.code ?? '') + ' ' + s.id).toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="tf-app">
      <aside className="tf-side">
        <header>
          <h1>AEPICK BEAUTY DNA <span>· FE TEST</span></h1>
          <p className="tf-sub">
            {SCREENS.length} màn hình · sửa file nguồn là màn hình đổi ngay (hot reload)
          </p>
        </header>
        <input className="tf-search" placeholder="Tìm màn hình…" value={filter}
          onChange={(e) => setFilter(e.target.value)} />
        <nav className="tf-nav">
          {GROUPS.map((g) => {
            const items = visible.filter((s) => s.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="tf-group">{GROUP_LABEL[g]}</div>
                {items.map((s) => (
                  <button key={s.id} className={`tf-item ${s.id === selected ? 'on' : ''}`}
                    onClick={() => { setSelected(s.id); setView('single'); }}>
                    {s.code && <span className="tf-code">{s.code}</span>}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="tf-main">
        <div className="tf-bar">
          <div className="tf-seg">
            <button className={view === 'single' ? 'on' : ''} onClick={() => setView('single')}>1 màn hình</button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>Xem tất cả</button>
          </div>

          <span className="tf-label">NGÔN NGỮ</span>
          <div className="tf-seg">
            {LANGS.map((l) => (
              <button key={l.code} className={lang === l.code ? 'on' : ''} onClick={() => setLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>

          <span className="tf-label">NỀN</span>
          <select className="tf-select" value={toneId} onChange={(e) => pickTone(e.target.value)}
            title="Xem thử tone nền khác. Mặc định là tone đang có trong styles.css.">
            <option value={SOURCE}>Theo code (styles.css)</option>
            {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {/* 토큰을 그대로 읽으므로 '코드 그대로'일 때도 실제 색이 보인다 */}
          <span className="tf-swatch" aria-hidden
            style={{ background: 'linear-gradient(180deg, var(--bg-1), var(--bg-0))' }} />
          <button className="tf-btn" onClick={copyToneCss}
            title="Sao chép 4 dòng CSS của tone này để dán vào styles.css">
            {copied ? '✓ Đã chép' : '⧉ Copy CSS'}
          </button>

          {view === 'single' && (
            <>
              <span className="tf-label">ZOOM {zoom}%</span>
              <input className="tf-zoom" type="range" min={40} max={160} step={5}
                value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </>
          )}

          <button className="tf-btn" onClick={() => setReplay((n) => n + 1)}>↻ Phát lại</button>

          <label className="tf-check"
            title="Bật = chạy thử cả luồng như bản thật (màn hình tự nhảy tiếp). Tắt = đứng yên một màn để sửa giao diện.">
            <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
            Tự chuyển màn
          </label>

          <div className="tf-spacer" />
          <span className="tf-label">← → đổi màn hình</span>
        </div>

        {view === 'single' ? (
          <div className="tf-view" ref={viewRef}>
            <Frame entry={entry} lang={lang} autoplay={autoplay} scale={fitScale(entry)} replay={replay} tone={tone} />
          </div>
        ) : (
          <div className="tf-view grid" ref={viewRef}>
            {GROUPS.map((g) => {
              const items = visible.filter((s) => s.group === g);
              if (!items.length) return null;
              return (
                <section className="tf-gridgroup" key={g}>
                  <h2>{GROUP_LABEL[g]}</h2>
                  <div className="tf-grid">
                    {items.map((s) => {
                      const sc = thumbScale(s);
                      const natural = naturalSize(s);
                      return (
                        <div className="tf-card" key={s.id}
                          onClick={() => { setSelected(s.id); setView('single'); }}>
                          <Lazy height={natural.h * sc}>
                            <Frame entry={s} lang={lang} autoplay={false} scale={sc} replay={replay} tone={tone} />
                          </Lazy>
                          <div className="tf-cap">
                            {s.code && <b>{s.code}</b>}
                            {s.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <footer className="tf-meta">
          <div className="tf-note">
            <b style={{ color: '#ece8ef' }}>{entry.label}</b> — {entry.note}
          </div>
          <span className="tf-label">SỬA FILE</span>
          <code>{entry.source}</code>
        </footer>
      </main>
    </div>
  );
}
