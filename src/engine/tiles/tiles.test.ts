/**
 * @pyramid-spec      design/engine/tiles/tiles.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/tiles/tiles.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, BOARD, TILE_TYPES } from '../../data/data';
import { createContext, newGameState } from '../core/core';
import { resolveTile } from './tiles';

describe('tiles 통합', () => {
  it('모든 칸 종류가 극단 상태에서도 예외 없이 끝나고 현금은 0 이상', () => {
    for (const type of TILE_TYPES) {
      const t = BOARD.tiles.find((x) => x.type === type);
      if (!t) continue;
      for (const variant of ['empty', 'rich'] as const) {
        for (const era of [0, 3, 4, 6]) {
          const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }, { id: 'b', name: 'B', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 1 });
          s.era = era;
          const p = s.players[0];
          p.tile = t.i;
          if (variant === 'rich') { p.job = 'baseball'; p.spouse = '지우'; p.cards = ['insurance']; s.partners.forEach((c) => { c.takenBy = 'b'; }); }
          const c = createContext(s);
          expect(() => resolveTile(c, p)).not.toThrow();
          expect(c.events[0]).toMatchObject({ t: 'land', tile: t.i, type });
          expect(JSON.parse(JSON.stringify(s))).toEqual(s);
          for (const pl of s.players) expect(pl.money).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
