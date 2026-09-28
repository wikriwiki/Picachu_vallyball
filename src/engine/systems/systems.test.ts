/**
 * @pyramid-spec      design/engine/systems/systems.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/systems/systems.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, jobById } from '../../data/data';
import { createContext, newGameState } from '../core/core';
import { marry, promoteOne, setPartner, useCard } from './systems';

const make = () => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 5 });
  s.era = 4;
  return { s, c: createContext(s), p: s.players[0] };
};

describe('systems 통합', () => {
  it('결혼하면 spouse 가 있고 후보의 takenBy 가 그 플레이어', () => {
    const { s, c, p } = make();
    setPartner(c, p, s.partners[2], 80);
    marry(c, p);
    expect(p.spouse).toBe(s.partners[2].name);
    expect(s.partners[2].takenBy).toBe('a');
  });
  it('rank 는 0 ~ 랭크 수 −1', () => {
    const { c, p } = make();
    p.job = 'idol';
    for (let i = 0; i < 10; i++) promoteOne(c, p);
    expect(p.rank).toBe(jobById('idol')!.ranks.length - 1);
  });
  it('카드는 정확히 한 장 빠지고 두 번 못 쓴다', () => {
    const { s, c, p } = make();
    p.cards = ['charm', 'study'];
    s.pending = { type: 'spin', playerId: 'a', purpose: 'move', title: '' };
    useCard(c, p, { type: 'card', index: 0 });
    expect(p.cards).toEqual(['study']);
    expect(() => useCard(c, p, { type: 'card', index: 0 })).toThrow();
  });
});
