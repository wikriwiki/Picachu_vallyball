/**
 * @pyramid-spec      design/engine/tiles/crisis/crisis.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/crisis/crisis.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, HIYARI } from '../../../data/data';
import { createContext, newGameState, type SpinPending } from '../../core/core';
import { onGhost, onHiyari, resolveHiyari } from './crisis';

const make = (era: number) => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 1 });
  s.era = era;
  return { s, c: createContext(s), p: s.players[0] };
};

describe('crisis', () => {
  it('1: 물방울 칸', () => {
    const { s, c, p } = make(2);
    onHiyari(c, p);
    expect(HIYARI.kid.map((e) => e.t)).toContain((c.events[0] as { text: string }).text);
    const pend = s.pending as SpinPending;
    expect(pend.purpose).toBe('hiyari');
    expect(['int', 'phy', 'sen']).toContain(pend.stat);
  });
  it('2: 변동 룰렛', () => {
    const { c, p } = make(2);
    const pend: SpinPending = { type: 'spin', playerId: 'a', purpose: 'hiyari', stat: 'phy', title: '' };
    p.stats.phy = 20;
    resolveHiyari(c, p, pend, 1);
    expect(p.stats.phy).toBe(8);
    p.stats.phy = 20;
    resolveHiyari(c, p, pend, 10);
    expect(p.stats.phy).toBe(26);
  });
  it('3: 보험 카드로 방어', () => {
    const { c, p } = make(4);
    p.cards = ['insurance', 'double'];
    onGhost(c, p);
    expect(p.cards).toEqual(['double']);
    expect(p.fortune).toBe(3);
    expect(c.events.some((e) => e.t === 'card' && e.used)).toBe(true);
  });
  it('4: 보험 없으면 손해 + 운세 −1', () => {
    const { c, p } = make(4);
    onGhost(c, p);
    expect(p.fortune).toBe(2);
    expect(c.events.some((e) => e.t === 'money' || e.t === 'stat')).toBe(true);
  });
  it('5: 보험 두 장이면 한 장만', () => {
    const { c, p } = make(0);
    p.cards = ['insurance', 'insurance'];
    onGhost(c, p);
    expect(p.cards).toEqual(['insurance']);
  });
});
