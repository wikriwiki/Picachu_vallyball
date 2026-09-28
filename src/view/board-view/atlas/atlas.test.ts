/**
 * @pyramid-spec      design/view/board-view/atlas/atlas.md
 * @pyramid-parent    design/view/board-view/board-view.md
 * @pyramid-on-change 1) design/view/board-view/atlas/atlas.md 먼저 수정 2) 이 코드 수정 3) design/view/board-view/board-view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { atlasCell, makeIconAtlas } from './atlas';

describe('atlas', () => {
  it('1: 칸 중심', () => { expect(atlasCell(7)).toEqual({ cx: 192, cy: 192 }); });
  it('2: 번호', () => { expect(makeIconAtlas().index('star3')).toBe(3); });
  it('3: 컨텍스트 없는 환경', () => { expect(makeIconAtlas().grid.toArray()).toEqual([6, 6]); });
});
