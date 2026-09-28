/**
 * @pyramid-spec      design/engine/core/setup/setup.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/setup/setup.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, BOARD } from '../../../data/data';
import { newGameState } from './setup';
import { RuleError } from '../types/types';

const seeds = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false }));

describe('setup', () => {
  it('1: 인원 검사', () => {
    expect(() => newGameState({ players: [], seed: 1 })).toThrow(RuleError);
    expect(() => newGameState({ players: seeds(5), seed: 1 })).toThrow(RuleError);
  });
  it('2: 결정적', () => {
    expect(JSON.stringify(newGameState({ players: seeds(2), seed: 1 }))).toBe(JSON.stringify(newGameState({ players: seeds(2), seed: 1 })));
  });
  it('3: 다른 시드', () => {
    expect(newGameState({ players: seeds(2), seed: 1 }).rng).not.toBe(newGameState({ players: seeds(2), seed: 2 }).rng);
  });
  it('4: full 초기값', () => {
    const s = newGameState({ players: seeds(2), seed: 1 });
    for (const p of s.players) {
      expect(p.tile).toBe(BOARD.eraStart[0]);
      expect(p.money).toBe(0);
      expect(p.stats).toEqual({ int: 5, phy: 5, sen: 5 });
    }
    expect(s.era).toBe(0);
  });
  it('5: adult 모드', () => {
    const s = newGameState({ players: seeds(2), seed: 7, mode: 'adult' });
    expect(s.era).toBe(4);
    for (const p of s.players) {
      expect(p.tile).toBe(BOARD.eraStart[4]);
      expect(p.money).toBe(300);
      for (const v of Object.values(p.stats)) { expect(v).toBeGreaterThanOrEqual(15); expect(v).toBeLessThanOrEqual(59); }
    }
  });
  it('6: 후보 12명', () => {
    const s = newGameState({ players: seeds(1), seed: 3 });
    expect(s.partners.length).toBe(12);
    for (const c of s.partners) { expect(c.stars).toBeGreaterThanOrEqual(1); expect(c.stars).toBeLessThanOrEqual(5); expect(c.takenBy).toBeNull(); }
  });
});
