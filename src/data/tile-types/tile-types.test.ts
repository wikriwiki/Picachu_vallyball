/**
 * @pyramid-spec      design/data/tile-types/tile-types.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/tile-types/tile-types.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { SUBMAPS, SUBMAP_IDS, TILE_INFO, TILE_TYPES } from './tile-types';

describe('tile-types', () => {
  it('1: 종류 26개', () => {
    expect(TILE_TYPES.length).toBe(26);
    expect(new Set(Object.keys(TILE_INFO))).toEqual(new Set(TILE_TYPES));
  });
  it('2: 서브맵 10칸', () => {
    for (const id of SUBMAP_IDS) {
      const t = SUBMAPS[id].tiles;
      expect(t.length).toBe(10);
      expect(t[0]).toBe('substart');
      expect(t[9]).toBe('return');
    }
  });
  it('3: star3 번호', () => { expect(TILE_TYPES.indexOf('star3')).toBe(3); });
});
