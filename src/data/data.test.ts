/**
 * @pyramid-spec      design/data/data.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/data/data.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as D1 from './data';

describe('data 통합', () => {
  it('두 번 import 해도 같은 BOARD', async () => {
    const D2 = await import('./data');
    expect(D2.BOARD).toBe(D1.BOARD);
  });
  it('보드 428칸 (본 맵 398 + 서브맵 30)', () => {
    expect(D1.BOARD.tiles.length).toBe(428);
    expect(D1.BOARD.tiles.filter((t) => t.era < 0).length).toBe(30);
  });
  it('모든 자식의 공개 이름이 한 곳에서 보인다', () => {
    for (const k of ['ERAS', 'EVENTS', 'TILE_INFO', 'BOARD', 'createRng', 'formatMoney', 'AVATAR_DEFAULT']) expect(k in D1).toBe(true);
  });
});
