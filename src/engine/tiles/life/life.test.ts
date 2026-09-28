/**
 * @pyramid-spec      design/engine/tiles/life/life.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/life/life.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, type Tile } from '../../../data/data';
import { createContext, newGameState, type ChoicePending, type SpinPending } from '../../core/core';
import { onBaby, onChoice, onGoal, onStop, resolveEvent, resolveGamble, resolveHouse } from './life';

const make = (n = 1, era = 4) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 2 });
  s.era = era;
  return { s, c: createContext(s), p: s.players[0] };
};

describe('life', () => {
  it('1: 선택 칸', () => {
    const { s, c, p } = make();
    onChoice(c, p);
    const pend = s.pending as ChoicePending;
    expect(pend.kind).toBe('event');
    expect(pend.options.length).toBeGreaterThanOrEqual(2);
    expect(pend.options.every((o) => o.effect)).toBe(true);
  });
  it('2: 선택 판정', () => {
    const { c, p } = make();
    resolveEvent(c, p, { type: 'choice', kind: 'event', playerId: 'p0', title: '', options: [{ label: 'x', effect: { int: 5 } }] }, 0);
    expect(p.stats.int).toBe(10);
  });
  it('3: 투자', () => {
    const { c, p } = make();
    const pend: SpinPending = { type: 'spin', playerId: 'p0', purpose: 'gamble', amount: 1000, title: '' };
    resolveGamble(c, p, pend, 5);
    expect(p.money).toBe(2000);
    resolveGamble(c, p, pend, 4);
    expect(p.money).toBe(1000);
  });
  it('4: 기혼 출산', () => {
    const { s, c, p } = make(2);
    p.spouse = '지우';
    onBaby(c, p);
    expect(p.kids.length).toBe(1);
    expect(c.events.some((e) => e.t === 'kid')).toBe(true);
    expect(p.money).toBe(100);
    expect(s.players[1].notes).toBe(1);
  });
  it('5: 미혼 조카', () => {
    const { c, p } = make();
    onBaby(c, p);
    expect(p.notes).toBe(1);
    expect(p.money).toBe(900);
    expect(p.fortune).toBe(4);
  });
  it('6: 집 STOP 선택지', () => {
    const { s, c, p } = make();
    onStop(c, p, { stop: 'house', type: 'stop' } as Tile);
    expect((s.pending as ChoicePending).options.length).toBe(5);
  });
  it('7: 집 구입', () => {
    const { s, c, p } = make();
    p.money = 1000;
    onStop(c, p, { stop: 'house', type: 'stop' } as Tile);
    resolveHouse(c, p, s.pending as ChoicePending, 0);
    expect(p.houses.length).toBe(1);
    expect(p.notes).toBe(2);
    expect(c.events.some((e) => e.t === 'house')).toBe(true);
  });
  it('8: GOAL 순서', () => {
    const { s, c, p } = make();
    s.finishCount = 1;
    onGoal(c, p);
    expect(p.finishOrder).toBe(1);
    expect(s.finishCount).toBe(2);
    expect(c.events.some((e) => e.t === 'msg' && e.text === '2등으로 GOAL!')).toBe(true);
  });
});
