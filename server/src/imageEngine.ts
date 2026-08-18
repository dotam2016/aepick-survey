import sharp from 'sharp';
import { existsSync } from 'node:fs';

// libvips 연산 캐시가 입력 파일 핸들을 유지해 Windows에서 원본 삭제가 거부되는
// 문제 방지 (원본 사진 즉시 삭제 정책의 전제 조건)
sharp.cache(false);
import path from 'node:path';
import { AXES, PERSONAS, type Axis, type PersonaId, type Scores } from '@aepick/shared';
import { RESULT_DIR } from './db.js';

export interface ComposeInput {
  photoPath: string | null; // null = 아바타 모드
  avatarId: string | null;
  persona: PersonaId;
  scores: Scores;
  nickname: string;
  token: string;
  /** Phase B: 생성형 AI 결과 이미지. 있으면 배경 전체로 사용하고 브랜딩만 얹는다 */
  aiBasePath?: string | null;
}

export interface ComposedImages {
  story916: string;
  feed45: string;
  plain: string;
  card: string;
}

const HASHTAG = '#AEPICKBeautyDNA';
const VENUE = 'AEPICK Pop-up · Hanoi 2026';

/** 6축 미니 레이더 SVG path 생성 */
function radarSvg(scores: Scores, cx: number, cy: number, R: number, color: string): string {
  const angle = (i: number) => (Math.PI * 2 * i) / 6 - Math.PI / 2;
  const pt = (i: number, r: number) => `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
  const grid = [0.5, 1]
    .map((f) => `<polygon points="${AXES.map((_, i) => pt(i, R * f)).join(' ')}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>`)
    .join('');
  const value = `<polygon points="${AXES.map((a, i) => pt(i, (R * scores[a as Axis]) / 100)).join(' ')}" fill="${color}55" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>`;
  const labels = AXES.map((a, i) => {
    const [x, y] = pt(i, R * 1.32).split(',');
    const label = a === 'localFit' ? 'Local' : a[0].toUpperCase() + a.slice(1);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.85)" font-size="${R * 0.22}" font-weight="700" font-family="sans-serif">${label}</text>`;
  }).join('');
  return grid + value + labels;
}

/** 축 모티프 장식 (상위 2축) */
function motifSvg(axis: Axis, W: number, H: number, seedY: number): string {
  const c = 'rgba(255,255,255,0.28)';
  switch (axis) {
    case 'repick': // 원형 궤도
      return `<circle cx="${W * 0.5}" cy="${seedY}" r="${W * 0.42}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="4 14"/>
              <circle cx="${W * 0.5}" cy="${seedY}" r="${W * 0.48}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="2 10"/>`;
    case 'value': // 기하학
      return `<rect x="${W * 0.08}" y="${seedY - 40}" width="80" height="80" fill="none" stroke="${c}" stroke-width="3" transform="rotate(45 ${W * 0.08 + 40} ${seedY})"/>
              <rect x="${W * 0.8}" y="${seedY + 60}" width="56" height="56" fill="none" stroke="${c}" stroke-width="3" transform="rotate(20 ${W * 0.8 + 28} ${seedY + 88})"/>`;
    case 'care': // 보호막 링
      return `<circle cx="${W * 0.5}" cy="${seedY}" r="${W * 0.38}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="10" opacity="0.5"/>`;
    case 'trend': // 네온 웨이브
      return `<path d="M0 ${seedY} Q ${W * 0.25} ${seedY - 90}, ${W * 0.5} ${seedY} T ${W} ${seedY}" fill="none" stroke="${c}" stroke-width="6"/>
              <path d="M0 ${seedY + 40} Q ${W * 0.25} ${seedY - 50}, ${W * 0.5} ${seedY + 40} T ${W} ${seedY + 40}" fill="none" stroke="${c}" stroke-width="3"/>`;
    case 'localFit': // 하노이 스카이라인 실루엣
      return `<path d="M0 ${seedY} h${W * 0.1} v-46 h30 v46 h${W * 0.08} v-90 h24 l12 -30 l12 30 h20 v90 h${W * 0.1} v-60 h36 v60 h${W * 0.12} v-110 h28 v110 H${W} v200 H0 Z" fill="${c}" opacity="0.5"/>`;
    case 'trust': // 별빛
      return [0.15, 0.35, 0.62, 0.82]
        .map((fx, i) => `<path d="M${W * fx} ${seedY + (i % 2 ? 60 : -30)} l7 20 l21 2 l-16 14 l5 21 l-17 -12 l-17 12 l5 -21 l-16 -14 l21 -2 Z" fill="${c}"/>`)
        .join('');
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]!));
}

/**
 * Phase A — Template Generator (기능정의서 4.4)
 * 레이어: 그라디언트 배경 → 축 모티프 → 사진(타원 마스크+발광 링) → 로고/타이포/레이더/닉네임/해시태그
 */
async function composeVariant(input: ComposeInput, W: number, H: number, opts: { overlay: boolean; photo: boolean }): Promise<Buffer> {
  const p = PERSONAS[input.persona];
  const topAxesSorted = [...AXES].sort((a, b) => input.scores[b as Axis] - input.scores[a as Axis]);
  const [ax1, ax2] = [topAxesSorted[0] as Axis, topAxesSorted[1] as Axis];

  // Phase B: AI 생성 이미지가 있으면 배경 전체로 사용 (기획안 8.3 — 로고·텍스트는 여기서 합성)
  let aiLayer = '';
  const useAiBase = !!input.aiBasePath && existsSync(input.aiBasePath);
  if (useAiBase) {
    const filled = await sharp(input.aiBasePath!).resize(W, H, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
    aiLayer = `
      <image href="data:image/jpeg;base64,${filled.toString('base64')}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
      <rect width="${W}" height="${H}" fill="url(#readability)"/>`;
  }

  // 사진을 base64로 임베드 (타원 클립) — AI 배경을 쓰면 생략
  let photoLayer = '';
  const photoW = W * 0.56;
  const photoH = photoW * (4 / 3);
  const photoX = (W - photoW) / 2;
  const photoY = H * 0.16;
  if (!useAiBase && opts.photo && input.photoPath && existsSync(input.photoPath)) {
    const resized = await sharp(input.photoPath)
      .resize(Math.round(photoW), Math.round(photoH), { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toBuffer();
    const b64 = resized.toString('base64');
    photoLayer = `
      <clipPath id="face"><ellipse cx="${photoX + photoW / 2}" cy="${photoY + photoH / 2}" rx="${photoW / 2}" ry="${photoH / 2}"/></clipPath>
      <ellipse cx="${photoX + photoW / 2}" cy="${photoY + photoH / 2}" rx="${photoW / 2 + 10}" ry="${photoH / 2 + 10}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="6"/>
      <ellipse cx="${photoX + photoW / 2}" cy="${photoY + photoH / 2}" rx="${photoW / 2 + 26}" ry="${photoH / 2 + 26}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="14"/>
      <image href="data:image/jpeg;base64,${b64}" x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" clip-path="url(#face)" preserveAspectRatio="xMidYMid slice"/>`;
  } else if (!useAiBase && opts.photo && input.avatarId) {
    photoLayer = `
      <ellipse cx="${W / 2}" cy="${photoY + photoH / 2}" rx="${photoW / 2}" ry="${photoH / 2}" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" stroke-width="6"/>
      <text x="${W / 2}" y="${photoY + photoH / 2}" text-anchor="middle" dominant-baseline="central" font-size="${photoW * 0.5}">${escapeXml(input.avatarId)}</text>`;
  }

  const radar = opts.overlay ? radarSvg(input.scores, W / 2, H * 0.78, W * 0.13, p.primaryColor) : '';
  const overlay = opts.overlay
    ? `
      <text x="${W / 2}" y="${H * 0.075}" text-anchor="middle" fill="#ffffff" font-size="${W * 0.036}" font-weight="800" letter-spacing="10" font-family="sans-serif">AEPICK BEAUTY DNA</text>
      <text x="${W / 2}" y="${H * 0.62}" text-anchor="middle" fill="#ffffff" font-size="${W * 0.072}" font-weight="900" font-family="sans-serif">${escapeXml(PERSONAS[input.persona].name)}</text>
      ${input.nickname ? `<text x="${W / 2}" y="${H * 0.66}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="${W * 0.034}" font-weight="600" font-family="sans-serif">${escapeXml(input.nickname)}</text>` : ''}
      ${radar}
      <text x="${W / 2}" y="${H * 0.93}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="${W * 0.03}" font-weight="700" font-family="sans-serif">${HASHTAG}</text>
      <text x="${W / 2}" y="${H * 0.955}" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-size="${W * 0.024}" font-family="sans-serif">${VENUE}</text>`
    : `<text x="${W / 2}" y="${H * 0.955}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="${W * 0.024}" letter-spacing="6" font-family="sans-serif">AEPICK</text>`;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${p.primaryColor}"/>
        <stop offset="100%" stop-color="${p.secondaryColor}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.32" r="0.6">
        <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <!-- AI 배경 위 텍스트 가독성 확보용 상·하단 그라디언트 -->
      <linearGradient id="readability" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.42)"/>
        <stop offset="30%" stop-color="rgba(0,0,0,0.05)"/>
        <stop offset="62%" stop-color="rgba(0,0,0,0.15)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.62)"/>
      </linearGradient>
    </defs>
    ${useAiBase ? aiLayer : `
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      ${motifSvg(ax1, W, H, H * 0.3)}
      ${motifSvg(ax2, W, H, H * 0.55)}`}
    ${photoLayer}
    ${overlay}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** DNA 결과 카드 (사진 없이 페르소나+레이더) */
async function composeCard(input: ComposeInput): Promise<Buffer> {
  const W = 1080, H = 1350;
  const p = PERSONAS[input.persona];
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.primaryColor}"/><stop offset="100%" stop-color="${p.secondaryColor}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="40" fill="rgba(12,6,24,0.55)"/>
    <text x="${W / 2}" y="150" text-anchor="middle" fill="#ffffff" font-size="36" font-weight="800" letter-spacing="10" font-family="sans-serif">AEPICK BEAUTY DNA</text>
    <text x="${W / 2}" y="280" text-anchor="middle" fill="#ffffff" font-size="76" font-weight="900" font-family="sans-serif">${escapeXml(p.name)}</text>
    ${input.nickname ? `<text x="${W / 2}" y="345" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="34" font-family="sans-serif">${escapeXml(input.nickname)}</text>` : ''}
    ${radarSvg(input.scores, W / 2, 750, 260, p.primaryColor)}
    <text x="${W / 2}" y="${H - 130}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="32" font-weight="700" font-family="sans-serif">${HASHTAG}</text>
    <text x="${W / 2}" y="${H - 80}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="26" font-family="sans-serif">${VENUE}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** 4종 변형 생성 → 파일 저장 → 상대 경로 반환 */
export async function generateTemplateResult(input: ComposeInput): Promise<ComposedImages> {
  const dir = path.join(RESULT_DIR, input.token);
  await sharp({ create: { width: 1, height: 1, channels: 3, background: '#000' } }).png().toBuffer(); // sharp warm-up
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });

  const [story, feed, plain, card] = await Promise.all([
    composeVariant(input, 1080, 1920, { overlay: true, photo: true }),
    composeVariant(input, 1080, 1350, { overlay: true, photo: true }),
    composeVariant(input, 1080, 1920, { overlay: false, photo: true }),
    composeCard(input),
  ]);

  const write = async (name: string, buf: Buffer) => {
    const file = path.join(dir, name);
    await sharp(buf).jpeg({ quality: 90 }).toFile(file);
    return `/static/results/${input.token}/${name}`;
  };

  return {
    story916: await write('story916.jpg', story),
    feed45: await write('feed45.jpg', feed),
    plain: await write('plain.jpg', plain),
    card: await write('card.jpg', card),
  };
}

// Phase B 생성 어댑터는 genai.ts 로 분리되어 있다 (imageJob이 직접 호출).
