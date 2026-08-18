/**
 * ─────────────────────────────────────────────────────────────
 *  Phase B — 생성형 AI 이미지 어댑터 (Google Gemini 이미지 모델)
 * ─────────────────────────────────────────────────────────────
 *  사용법:
 *    AI_PROVIDER=gemini  GEMINI_API_KEY=<키>  npm run demo
 *
 *  · 키가 없거나 호출이 실패/지연되면 상위(imageJob)가 자동으로
 *    템플릿 합성으로 폴백하므로 체험은 항상 끝까지 완료된다.
 *  · 얼굴 사진을 입력으로 주고 "정체성 유지 + 배경/조명/무드 생성"을
 *    지시하는 image-to-image 방식이다(기획안 8.3).
 *  · 모델명은 GEMINI_IMAGE_MODEL 로 교체할 수 있다.
 */
import { readFile } from 'node:fs/promises';
import { PERSONAS, type Axis, type PersonaId } from '@aepick/shared';
import { AXIS_MOTIFS } from '@aepick/shared';

const API_KEY = process.env.GEMINI_API_KEY ?? '';
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
const ENDPOINT = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export const isGenAiConfigured = () => API_KEY.length > 0;

/** 축 모티프를 시각 요소 문구로 (기획안 8.2) */
const MOTIF_PHRASE: Record<string, string> = {
  orbit: 'soft repeating ribbons and circular light orbits',
  geometry: 'clean balanced geometric shapes',
  shield: 'a translucent protective veil with fresh hydrated texture',
  neon: 'experimental neon waves',
  hanoi: 'warm Hanoi evening light with tropical foliage',
  stars: 'delicate starlight sparkles',
};

export interface GenAiInput {
  photoPath: string;
  persona: PersonaId;
  mood: 'soft' | 'bright' | 'chic';
  topAxes: [Axis, Axis];
}

/** DNA 결과 → 이미지 프롬프트 (기획안 8.3 2단계) */
export function buildPrompt(input: GenAiInput): string {
  const p = PERSONAS[input.persona];
  const motifs = input.topAxes.map((a) => MOTIF_PHRASE[AXIS_MOTIFS[a]] ?? '').filter(Boolean);
  return [
    'Transform this portrait into a dreamy beauty campaign visual.',
    `CRITICAL: keep the person's facial identity, features and skin tone clearly recognizable — do not replace the face.`,
    'Do not smooth or retouch the skin heavily; keep it natural.',
    `Style mood: ${p.mood}, ${input.mood}.`,
    `Color palette: ${p.primaryColor} and ${p.secondaryColor}.`,
    `Add around the subject: ${motifs.join(', ')}.`,
    'Soft studio lighting, glossy beauty aesthetic, vertical portrait composition.',
    'Do NOT render any text, letters, logos or watermarks in the image.',
  ].join(' ');
}

/**
 * 얼굴 사진 + 프롬프트 → 생성 이미지(PNG/JPEG 버퍼).
 * 실패 시 예외를 던지고, 호출부가 템플릿으로 폴백한다.
 */
export async function generateWithGemini(input: GenAiInput, signal?: AbortSignal): Promise<Buffer> {
  if (!isGenAiConfigured()) throw new Error('GEMINI_API_KEY not set');

  const photo = await readFile(input.photoPath);
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: buildPrompt(input) },
        { inline_data: { mime_type: 'image/jpeg', data: photo.toString('base64') } },
      ],
    }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };

  const res = await fetch(ENDPOINT(MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`gemini ${res.status}: ${detail.slice(0, 180)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[] } }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inline_data?.data ?? part.inlineData?.data;
    if (data) return Buffer.from(data, 'base64');
  }
  throw new Error('gemini response contained no image');
}
