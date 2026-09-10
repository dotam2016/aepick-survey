import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, '../../packages/shared/src/i18n');

/** 서버 렌더링 페이지가 클라이언트에 그대로 내려보내는 다국어 사전 (vi/en/ko). */
export const dicts = Object.fromEntries(
  (['vi', 'en', 'ko'] as const).map((l) => [l, JSON.parse(readFileSync(path.join(I18N_DIR, `${l}.json`), 'utf-8'))]),
);
