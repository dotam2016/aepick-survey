/**
 * 시안 PNG에서 UI 에셋을 슬라이스한다.
 * 좌표는 원본 대비 비율(0~1)로 지정 — 시안 해상도가 바뀌어도 재사용 가능.
 *   node tools/slice-assets.mjs          → 에셋 생성
 *   node tools/slice-assets.mjs --sheet  → 검증용 컨택트시트만 생성
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = (await import(pathToFileURL(path.join(ROOT, 'node_modules/sharp/lib/index.js')).href)).default;
sharp.cache(false);

const SRC = path.join(ROOT, 'apps/kiosk/public/assets');
const OUT = path.join(SRC, 'ui');
mkdirSync(OUT, { recursive: true });

/** 슬라이스 정의: [소스, 이름, x1, y1, x2, y2, 옵션] — 좌표는 모두 비율 */
const SLICES = [
  // ── 브랜드 로고 (배경 제거)
  ['attract', 'logo', 0.330, 0.052, 0.665, 0.112, { alpha: 232 }],
  ['attract', 'logo-sub', 0.355, 0.112, 0.640, 0.132, { alpha: 236 }],

  // ── 인트로 젬 6종 (원형 마스크)
  ['intro', 'gem-gold', 0.420, 0.163, 0.578, 0.258, { circle: true }],
  ['intro', 'gem-purple', 0.278, 0.220, 0.430, 0.307, { circle: true }],
  ['intro', 'gem-blue', 0.570, 0.220, 0.726, 0.307, { circle: true }],
  ['intro', 'gem-green', 0.268, 0.322, 0.424, 0.410, { circle: true }],
  ['intro', 'gem-teal', 0.575, 0.322, 0.731, 0.410, { circle: true }],
  ['intro', 'gem-pink', 0.420, 0.373, 0.578, 0.464, { circle: true }],

  // ── 하트·장식 (가장자리만 살짝 페이드 — 핑크 배경 위에 얹는 전제)
  ['attract', 'heart-glossy', 0.828, 0.058, 0.965, 0.137, { feather: 0.82 }],
  ['attract', 'heart-small', 0.050, 0.900, 0.145, 0.952, { feather: 0.82 }],
  ['intro', 'heart-big', 0.735, 0.010, 1.000, 0.165, { feather: 0.82 }],
  ['language', 'heart-diamond', 0.828, 0.094, 1.000, 0.206, { feather: 0.85 }],
  ['core1', 'dna-helix', 0.000, 0.055, 0.130, 0.225, { feather: 0.85 }],
  ['core1', 'diamond', 0.860, 0.006, 1.000, 0.099, { feather: 0.85 }],

  // ── CORE1 제품 이미지 (텍스트 제외 — 라벨은 앱에서 다국어 렌더링)
  ['core1', 'product-serum', 0.030, 0.374, 0.338, 0.600],
  ['core1', 'product-cream', 0.358, 0.374, 0.646, 0.600],
  ['core1', 'product-lotion', 0.666, 0.374, 0.958, 0.600],

  // ── 진행률 젬 (루비 / 진주)
  ['core1', 'ruby', 0.285, 0.091, 0.345, 0.133, { circle: true }],
  ['core1', 'pearl', 0.363, 0.093, 0.418, 0.131, { circle: true }],

  // ── CORE2 코인
  ['core2', 'coin', 0.083, 0.328, 0.142, 0.369, { circle: true }],

  // ── 언어 국기
  ['language', 'flag-vn', 0.143, 0.410, 0.256, 0.477, { circle: true }],
  ['language', 'flag-en', 0.143, 0.562, 0.256, 0.630, { circle: true }],
  ['language', 'flag-kr', 0.143, 0.716, 0.256, 0.784, { circle: true }],

  // ── CORE3 방패 히어로 + 카드 아이콘 8종 (원형)
  ['core3', 'shield-hero', 0.395, 0.315, 0.610, 0.410, { feather: 0.88 }],
  ['core3', 'sh-fullIngredients', 0.086, 0.494, 0.160, 0.545, { circle: true }],
  ['core3', 'sh-celebrity', 0.530, 0.494, 0.604, 0.545, { circle: true }],
  ['core3', 'sh-skinType', 0.086, 0.590, 0.160, 0.641, { circle: true }],
  ['core3', 'sh-bestSeller', 0.530, 0.590, 0.604, 0.641, { circle: true }],
  ['core3', 'sh-realTest', 0.086, 0.680, 0.160, 0.731, { circle: true }],
  ['core3', 'sh-overclaim', 0.530, 0.680, 0.604, 0.731, { circle: true }],
  ['core3', 'sh-caution', 0.086, 0.769, 0.160, 0.820, { circle: true }],
  ['core3', 'sh-realReviews', 0.530, 0.769, 0.604, 0.820, { circle: true }],

  // ── S13 결과 화면: 6축 아이콘 + 하트 장식
  ['dnaresult', 'axis-repick', 0.468, 0.498, 0.532, 0.532, { circle: true }],
  ['dnaresult', 'axis-value', 0.722, 0.559, 0.786, 0.593, { circle: true }],
  ['dnaresult', 'axis-care', 0.722, 0.709, 0.786, 0.743, { circle: true }],
  ['dnaresult', 'axis-trend', 0.468, 0.770, 0.532, 0.804, { circle: true }],
  ['dnaresult', 'axis-localFit', 0.218, 0.709, 0.282, 0.743, { circle: true }],
  ['dnaresult', 'axis-trust', 0.218, 0.559, 0.282, 0.593, { circle: true }],
  ['dnaresult', 'heart-gem', 0.712, 0.198, 0.862, 0.276, { feather: 0.9 }],
  ['dnaresult', 'heart-badge', 0.222, 0.836, 0.302, 0.878, { circle: true }],

  // ── S12 분석 화면 (다크): DNA 오브 + 아이콘 젬 6종 (상단부터 시계방향)
  ['analyzing', 'dna-orb', 0.320, 0.222, 0.680, 0.478, { feather: 0.9 }],
  ['analyzing', 'dna-gem-1', 0.443, 0.155, 0.558, 0.231, { feather: 0.92 }],
  ['analyzing', 'dna-gem-2', 0.678, 0.236, 0.793, 0.312, { feather: 0.92 }],
  ['analyzing', 'dna-gem-3', 0.678, 0.405, 0.793, 0.481, { feather: 0.92 }],
  ['analyzing', 'dna-gem-4', 0.443, 0.490, 0.558, 0.566, { feather: 0.92 }],
  ['analyzing', 'dna-gem-5', 0.214, 0.405, 0.329, 0.481, { feather: 0.92 }],
  ['analyzing', 'dna-gem-6', 0.214, 0.236, 0.329, 0.312, { feather: 0.92 }],

  // ── CORE5 시나리오 사진·날씨 아이콘·적합도 하트
  ['core5', 'scenario-rainy', 0.048, 0.266, 0.338, 0.418],
  ['core5', 'weather-rain', 0.780, 0.272, 0.912, 0.338, { feather: 0.9 }],
  ['core5', 'fit-heart', 0.052, 0.742, 0.240, 0.836, { feather: 0.9 }],

  // ── CORE5 속성 아이콘 10종 (원형 크롭 없이 아이콘만, 색은 CSS filter로 상태 표현)
  ['core5', 'attr-light', 0.098, 0.456, 0.168, 0.494, { mask: 'light' }],
  ['core5', 'attr-rich', 0.548, 0.456, 0.618, 0.494, { mask: 'dark' }],
  ['core5', 'attr-matte', 0.098, 0.515, 0.168, 0.553, { mask: 'light' }],
  ['core5', 'attr-glow', 0.548, 0.515, 0.618, 0.553, { mask: 'dark' }],
  ['core5', 'attr-lasting', 0.098, 0.574, 0.168, 0.612, { mask: 'light' }],
  ['core5', 'attr-comfort', 0.548, 0.574, 0.618, 0.612, { mask: 'dark' }],
  ['core5', 'attr-deepMoist', 0.098, 0.632, 0.168, 0.670, { mask: 'dark' }],
  ['core5', 'attr-fastAbsorb', 0.548, 0.632, 0.618, 0.670, { mask: 'light' }],
  ['core5', 'attr-portable', 0.098, 0.690, 0.168, 0.728, { mask: 'light' }],
  ['core5', 'attr-jumbo', 0.548, 0.690, 0.618, 0.728, { mask: 'dark' }],

  // ── CORE4 트렌드 카드 인물 (텍스트·배지 제외 — 라벨은 앱에서 다국어 렌더링)
  ['trend1', 'trend-glassSkin', 0.200, 0.150, 0.800, 0.660],
  ['trend2', 'trend-softMatte', 0.215, 0.180, 0.790, 0.640],
  ['trend3', 'trend-naturalPeach', 0.195, 0.130, 0.805, 0.680],
  ['trend4', 'trend-boldColor', 0.205, 0.190, 0.795, 0.650],
  ['trend5', 'trend-minimalSkin', 0.210, 0.155, 0.790, 0.645],
  ['trend6', 'trend-y2k', 0.185, 0.115, 0.815, 0.680],

  // ── Attract 포토카드 · 스텝 아이콘 · 스탯 아이콘
  ['attract', 'photocards', 0.118, 0.138, 0.880, 0.440, { alpha: 246 }],
  ['attract', 'step-photo', 0.185, 0.722, 0.298, 0.788, { circle: true }],
  ['attract', 'step-picks', 0.446, 0.722, 0.559, 0.788, { circle: true }],
  ['attract', 'step-ai', 0.700, 0.718, 0.838, 0.792, { circle: true }],
  ['attract', 'icon-people', 0.118, 0.626, 0.211, 0.686, { circle: true }],
  ['attract', 'icon-fire', 0.522, 0.626, 0.620, 0.686, { circle: true }],
];

const px = (v, total) => Math.max(0, Math.round(v * total));

/** 밝은 배경을 투명 처리 (luminance 임계값) */
async function stripBackground(buf, threshold) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum >= threshold) data[i + 3] = 0;
    else if (lum > threshold - 22) data[i + 3] = Math.round(((threshold - lum) / 22) * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** 원형 마스크 */
async function circleMask(buf, w, h) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="#fff"/></svg>`,
  );
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/**
 * 아이콘을 CSS mask용 알파 실루엣으로 변환한다.
 * mode 'light' = 밝은 획이 아이콘(핑크 배경 위 흰 선), 'dark' = 어두운 획이 아이콘(흰 배경 위 회색 선).
 * 결과는 흰색 + 알파만 남으므로 앱에서 mask-image로 원하는 색을 입힐 수 있다.
 */
async function toMask(buf, mode) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const a = mode === 'light'
      ? (lum - 208) * 5.4   // 흰 획만 남김 (핑크 배경 광택 제외)
      : (218 - lum) * 3.2;  // 어두운 획만 남김
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    data[i + 3] = Math.max(0, Math.min(255, Math.round(a)));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** 가장자리만 부드럽게 페이드 (start 이후부터 투명해짐) */
async function featherMask(buf, w, h, start = 0.82) {
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5">
      <stop offset="${start}" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
     </radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
  );
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const results = [];
for (const [src, name, x1, y1, x2, y2, opt = {}] of SLICES) {
  const file = path.join(SRC, `src-${src}.png`);
  if (!existsSync(file)) { console.warn('missing source:', file); continue; }
  const meta = await sharp(file).metadata();
  const left = px(x1, meta.width), top = px(y1, meta.height);
  const width = px(x2, meta.width) - left, height = px(y2, meta.height) - top;

  let buf = await sharp(file).extract({ left, top, width, height }).png().toBuffer();
  if (opt.mask) buf = await toMask(buf, opt.mask);
  if (opt.alpha) buf = await stripBackground(buf, opt.alpha);
  if (opt.circle) buf = await circleMask(buf, width, height);
  if (opt.feather) buf = await featherMask(buf, width, height, typeof opt.feather === 'number' ? opt.feather : 0.82);

  await sharp(buf).toFile(path.join(OUT, `${name}.png`));
  results.push({ name, width, height, buf });
  console.log(`✓ ${name}.png  ${width}x${height}`);
}

/* 검증용 컨택트시트: 모든 슬라이스를 한 장에 격자 배치 */
const COLS = 6, CELL = 190, PAD = 8;
const rows = Math.ceil(results.length / COLS);
// 실제 사용 환경과 동일한 핑크 배경 위에서 확인
const sheet = sharp({
  create: { width: COLS * CELL, height: rows * (CELL + 22), channels: 4, background: '#fbeef2' },
});
const layers = [];
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const col = i % COLS, row = Math.floor(i / COLS);
  const scale = Math.min((CELL - PAD * 2) / r.width, (CELL - PAD * 2) / r.height, 1);
  const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
  layers.push({
    input: await sharp(r.buf).resize(w, h).png().toBuffer(),
    left: col * CELL + Math.round((CELL - w) / 2),
    top: row * (CELL + 22) + Math.round((CELL - h) / 2),
  });
  layers.push({
    input: Buffer.from(`<svg width="${CELL}" height="20"><text x="${CELL / 2}" y="14" text-anchor="middle" fill="#a4566f" font-size="12" font-family="sans-serif">${r.name}</text></svg>`),
    left: col * CELL, top: row * (CELL + 22) + CELL,
  });
}
await sheet.composite(layers).png().toFile(path.join(OUT, '_contact-sheet.png'));
console.log(`\n📋 contact sheet → assets/ui/_contact-sheet.png (${results.length} assets)`);
