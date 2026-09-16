/**
 * ─────────────────────────────────────────────────────────────
 *  배경 톤 후보 (Tone nền)
 * ─────────────────────────────────────────────────────────────
 *
 * 갤러리 상단 "NỀN"에서 고르면 모든 화면 배경이 그 톤으로 바뀐다.
 * 확정한 톤은 apps/kiosk/src/styles.css의 :root 네 값(--bg-0·--bg-1·
 * --bg-glow-a·--bg-glow-b)에 그대로 옮겨 적으면 운영 화면에 반영된다
 * (갤러리의 "Copy CSS" 버튼이 그 블록을 그대로 복사해 준다).
 *
 * 브라우저(Gallery)와 vite 플러그인(fe-test-pages.ts)이 함께 쓰므로 순수 데이터만 둔다.
 */

export interface Tone {
  id: string;
  /** 갤러리에 표시할 이름 */
  label: string;
  bg0: string; // 아래쪽
  bg1: string; // 위쪽
  glowA: string; // 우상단 글로우
  glowB: string; // 하단 글로우
}

export const TONES: Tone[] = [
  {
    // styles.css의 현재 값과 같아야 한다 (갤러리 첫 화면 = 실제 화면)
    id: 'coral', label: 'Coral #FF8177 (hiện tại)',
    bg1: '#fdf3f2', bg0: '#fae4e2',
    glowA: 'rgba(249,174,168,0.5)', glowB: 'rgba(247,155,148,0.5)',
  },
  {
    id: 'coral-soft', label: 'Coral nhạt hơn',
    bg1: '#fffbfa', bg0: '#fdefed',
    glowA: 'rgba(250,205,199,0.45)', glowB: 'rgba(248,191,184,0.4)',
  },
  {
    id: 'coral-warm', label: 'Coral ấm (ngả cam)',
    bg1: '#fdf4f1', bg0: '#fae6df',
    glowA: 'rgba(249,181,163,0.5)', glowB: 'rgba(247,164,140,0.5)',
  },
  {
    id: 'pink', label: 'Hồng baby (bản cũ)',
    bg1: '#fdf2f5', bg0: '#fae2e9',
    glowA: 'rgba(249,168,190,0.5)', glowB: 'rgba(247,148,176,0.5)',
  },
  {
    id: 'ivory', label: 'Kem ấm (ivory)',
    bg1: '#fffaf3', bg0: '#f7ead9',
    glowA: 'rgba(240,205,160,0.45)', glowB: 'rgba(236,190,145,0.45)',
  },
  {
    id: 'nude', label: 'Nude hồng đất',
    bg1: '#fdf6f3', bg0: '#f2e0d8',
    glowA: 'rgba(226,175,160,0.45)', glowB: 'rgba(216,160,145,0.42)',
  },
  {
    id: 'lavender', label: 'Tím lavender',
    bg1: '#faf6fd', bg0: '#eae0f7',
    glowA: 'rgba(193,167,235,0.45)', glowB: 'rgba(178,150,225,0.42)',
  },
  {
    id: 'mint', label: 'Xanh mint',
    bg1: '#f4fbf8', bg0: '#dcf0e8',
    glowA: 'rgba(135,205,185,0.42)', glowB: 'rgba(115,195,175,0.4)',
  },
  {
    id: 'clean', label: 'Trắng tối giản',
    bg1: '#ffffff', bg0: '#f4f4f6',
    glowA: 'rgba(224,224,232,0.7)', glowB: 'rgba(212,212,224,0.6)',
  },
];

export const DEFAULT_TONE = TONES[0];
export const toneById = (id: string): Tone => TONES.find((t) => t.id === id) ?? DEFAULT_TONE;

/** styles.css의 --bg-stage와 같은 4겹 그라디언트 (토큰 없이 쓰는 곳용) */
export function stageBackground(t: Tone): string {
  return [
    'radial-gradient(70% 40% at 10% 5%, rgba(255,255,255,0.75) 0%, transparent 65%)',
    `radial-gradient(55% 35% at 92% 12%, ${t.glowA} 0%, transparent 70%)`,
    `radial-gradient(80% 50% at 50% 108%, ${t.glowB} 0%, transparent 70%)`,
    `linear-gradient(180deg, ${t.bg1} 0%, ${t.bg0} 100%)`,
  ].join(',');
}

/** 무대 엘리먼트에 얹을 CSS 변수 (React style 객체로 그대로 사용) */
export function toneVars(t: Tone): Record<string, string> {
  return {
    '--bg-0': t.bg0,
    '--bg-1': t.bg1,
    '--bg-glow-a': t.glowA,
    '--bg-glow-b': t.glowB,
  };
}

/** styles.css에 붙여 넣을 :root 블록 */
export function toneCss(t: Tone): string {
  return `:root {
  /* Tone nền: ${t.label} */
  --bg-0: ${t.bg0};
  --bg-1: ${t.bg1};
  --bg-glow-a: ${t.glowA};
  --bg-glow-b: ${t.glowB};
}`;
}
