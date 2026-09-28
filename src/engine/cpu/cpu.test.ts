/**
 * @pyramid-spec      design/engine/cpu/cpu.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/cpu/cpu.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, HOUSES, JOBS, type CardId } from '../../data/data';
import { createContext, newGameState, type ChoicePending } from '../core/core';
import { makeJobChoice } from '../systems/systems';
import { chooseAction } from './cpu';

const make = () => newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: true }], seed: 2 });
const moveWith = (cards: CardId[]) => {
  const s = make();
  s.players[0].cards = cards;
  s.pending = { type: 'spin', playerId: 'a', purpose: 'move', title: '' };
  return s;
};
const choice = (s: ReturnType<typeof make>, kind: ChoicePending['kind'], options: ChoicePending['options']) => {
  s.pending = { type: 'choice', kind, playerId: 'a', title: '', options };
  return s;
};

describe('cpu', () => {
  it('1: 대기 없음', () => { expect(chooseAction(make())).toBeNull(); });
  it('2: 즉시 카드', () => { expect(chooseAction(moveWith(['charm']), () => 0.1)).toEqual({ type: 'card', index: 0 }); });
  it('3: 더블 카드', () => { expect(chooseAction(moveWith(['double']), () => 0.1)).toEqual({ type: 'card', index: 0 }); });
  it('4: 쓸 카드가 없으면 룰렛', () => { expect(chooseAction(moveWith(['rankup']), () => 0.5)).toEqual({ type: 'spin', power: 0.5 }); });
  it('5: 진로', () => {
    const s = choice(make(), 'career', [{ label: 'a' }, { label: 'b' }]);
    s.players[0].stats.int = 30;
    expect(chooseAction(s)).toEqual({ type: 'choose', index: 0 });
    s.players[0].stats.int = 10;
    expect(chooseAction(s)).toEqual({ type: 'choose', index: 1 });
  });
  it('6: 집', () => {
    const s = choice(make(), 'house', [...HOUSES.map((h) => ({ label: h.name, houseId: h.id })), { label: '안 삼' }]);
    s.players[0].money = 9000;
    expect(chooseAction(s)).toEqual({ type: 'choose', index: 1 });
  });
  it('7: 베팅', () => {
    const s = choice(make(), 'bet', [{ label: '' }, { label: '' }, { label: '' }]);
    s.players[0].money = 500;
    expect(chooseAction(s)).toEqual({ type: 'choose', index: 2 });
  });
  it('8: 직업', () => {
    const s = make();
    s.players[0].stats = { int: 100, phy: 100, sen: 100 };
    s.pending = makeJobChoice(createContext(s), s.players[0]);
    const a = chooseAction(s, () => 0.5) as { index: number };
    const best = Math.max(...JOBS.map((j) => j.ranks[Math.min(2, j.ranks.length - 1)].salary));
    const picked = JOBS[a.index];
    expect(picked.ranks[Math.min(2, picked.ranks.length - 1)].salary).toBe(best);
  });
});
