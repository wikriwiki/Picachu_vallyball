/**
 * @pyramid-spec      design/view/environment/environment.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/environment/environment.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { BOARD } from '../../data/data';
import { islandRectOf, subIslandsOf } from './environment';

describe('environment', () => {
  it('1: 본섬 사각형', () => {
    expect(islandRectOf([{ x: 0, z: 0, era: 0 }, { x: 10, z: 20, era: 0 }])).toEqual({ cx: 5, cz: 10, hx: 31, hz: 30, r: 22 });
  });
  it('2: 서브맵 칸 무시', () => {
    expect(islandRectOf([{ x: 0, z: 0, era: 0 }, { x: 10, z: 20, era: 0 }, { x: 500, z: 500, era: -1 }]).cx).toBe(5);
  });
  it('3: 서브맵 섬', () => {
    const s = subIslandsOf(BOARD.tiles);
    expect(s.map((x) => x.id)).toEqual(['countryside', 'casino', 'shrine']);
    const ts = BOARD.tiles.filter((t) => t.sub === 'casino' && t.era < 0);
    const xs = ts.map((t) => t.x);
    expect(s[1].cx).toBe((Math.min(...xs) + Math.max(...xs)) / 2);
  });
});
