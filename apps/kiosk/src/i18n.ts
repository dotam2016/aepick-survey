import vi from '@aepick/shared/i18n/vi.json';
import en from '@aepick/shared/i18n/en.json';
import ko from '@aepick/shared/i18n/ko.json';
import type { Language } from '@aepick/shared';

const DICTS: Record<Language, unknown> = { vi, en, ko };

function lookup(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key];
    return undefined;
  }, dict);
}

/** i18n 조회: 현재 언어 → en 폴백 → 키 자체 반환 */
export function makeT(lang: Language) {
  return (key: string, vars?: Record<string, string | number>): string => {
    let raw = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
    if (typeof raw !== 'string') return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) raw = (raw as string).replaceAll(`{${k}}`, String(v));
    }
    return raw as string;
  };
}

/** 배열/객체 리소스 조회 (stageLabels 등) */
export function makeTr(lang: Language) {
  return <T = unknown>(key: string): T => {
    const raw = lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
    return raw as T;
  };
}
