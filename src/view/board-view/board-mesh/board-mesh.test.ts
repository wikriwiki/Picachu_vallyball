/**
 * @pyramid-spec      design/view/board-view/board-mesh/board-mesh.md
 * @pyramid-parent    design/view/board-view/board-view.md
 * @pyramid-on-change 1) design/view/board-view/board-mesh/board-mesh.md 먼저 수정 2) 이 코드 수정 3) design/view/board-view/board-view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { BOARD, ERAS, type Tile } from '../../../data/data';
import { tileColor, tileGlow, tileHeadings } from './board-mesh';

const T = (i: number, x: number, z: number, next: number[] = []) => ({ i, x, z, next, era: 0, type: 'star1', route: 'main' } as Tile);

describe('board-mesh', () => {
  it('1: 세로 방향', () => { expect(tileHeadings([T(0, 0, 0, [1]), T(1, 0, 3)])).toEqual([0, 0]); });
  it('2: 가로 방향', () => {
    const h = tileHeadings([T(0, 0, 0, [1]), T(1, 3, 0)]);
    expect(h[0]).toBeCloseTo(Math.PI / 2); expect(h[1]).toBeCloseTo(Math.PI / 2);
  });
  it('3: 시대 시작 칸 색', () => { expect(tileColor(BOARD.tiles[BOARD.eraStart[1]])).toBe(ERAS[1].color); });
  it('4: GOAL 색', () => { expect(tileColor(BOARD.tiles[BOARD.eraEnd[6]])).toBe(0xffffff); });
  it('5: 발광', () => {
    expect([tileGlow({ type: 'star3' } as Tile), tileGlow({ type: 'destiny' } as Tile), tileGlow({ type: 'love' } as Tile)]).toEqual([1, 2, 0]);
  });
});
