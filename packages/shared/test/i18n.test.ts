import { describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import en from '../src/i18n/en.json';
import ko from '../src/i18n/ko.json';

/** 중첩 객체의 모든 리프 키 경로 수집 */
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  if (Array.isArray(obj)) return [prefix]; // 배열은 리프로 취급 (keywords, stageLabels)
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

const strip = (paths: string[]) => paths.filter((p) => !p.startsWith('_')).sort(); // _note 등 메타 제외

describe('i18n 키 정합성', () => {
  const enKeys = strip(keyPaths(en));
  it('vi는 en과 키 트리가 동일하다', () => {
    expect(strip(keyPaths(vi))).toEqual(enKeys);
  });
  it('ko는 en과 키 트리가 동일하다', () => {
    expect(strip(keyPaths(ko))).toEqual(enKeys);
  });
  it('빈 문자열 값이 없다', () => {
    for (const dict of [vi, en, ko]) {
      const check = (o: unknown, path: string) => {
        if (typeof o === 'string') expect(o.length, `empty: ${path}`).toBeGreaterThan(0);
        else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => check(v, `${path}.${k}`));
      };
      check(dict, '');
    }
  });
  it('페르소나 키워드는 각 3개다', () => {
    for (const dict of [vi, en, ko] as Record<string, any>[]) {
      const personas = dict.dna.personas;
      for (const [id, p] of Object.entries<any>(personas)) {
        expect(p.keywords, `${id} keywords`).toHaveLength(3);
      }
    }
  });
});
