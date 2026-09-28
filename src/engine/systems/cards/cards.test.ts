/**
 * @pyramid-spec      design/engine/systems/cards/cards.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/cards/cards.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, type CardId } from '../../../data/data';
import { RuleError, createContext, newGameState, type SpinPending } from '../../core/core';
import { useCard } from './cards';

const make = (cards: CardId[], n = 1) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 3 });
  const p = s.players[0];
  p.cards = cards;
  s.pending = { type: 'spin', playerId: p.id, purpose: 'move', title: '' };
  return { s, c: createContext(s), p };
};
const use = (m: ReturnType<typeof make>, index = 0, number?: number) => useCard(m.c, m.p, { type: 'card', index, number });

describe('cards', () => {
  it('1: 선택 대기에는 불가', () => {
    const m = make(['charm']);
    m.s.pending = { type: 'choice', kind: 'event', playerId: 'p0', title: '', options: [] };
    expect(() => use(m)).toThrow('이동 룰렛 전에만');
  });
  it('2: 한 턴 1장', () => {
    const m = make(['charm']);
    m.p.cardUsed = true;
    expect(() => use(m)).toThrow('한 턴에 1장');
  });
  it('3: 보험 수동 불가', () => { expect(() => use(make(['insurance']))).toThrow('자동으로'); });
  it('4: 지정 룰렛', () => {
    const m = make(['fixed']);
    expect(() => use(m, 0, 11)).toThrow(RuleError);
    expect(m.p.cards).toEqual(['fixed']);
    use(m, 0, 7);
    expect((m.s.pending as SpinPending).fixed).toBe(7);
    expect(m.p.cards).toEqual([]);
  });
  it('5: 더블', () => {
    const m = make(['double']);
    use(m);
    expect((m.s.pending as SpinPending).double).toBe(true);
  });
  it('6: 가로채기', () => {
    const m = make(['steal'], 3);
    m.s.players[1].money = 300; m.s.players[2].money = 800;
    use(m);
    expect(m.s.players[2].money).toBe(300);
    expect(m.p.money).toBe(500);
  });
  it('7: 승진 카드 직업 없음', () => { expect(() => use(make(['rankup']))).toThrow('직업이 있어야'); });
  it('8: 학습 코스', () => {
    const m = make(['study']);
    use(m);
    expect(m.p.stats.int).toBe(15);
    expect(m.p.cardUsed).toBe(true);
  });
});
