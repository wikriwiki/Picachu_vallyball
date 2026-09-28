/**
 * @pyramid-spec      design/engine/flow/movement/movement.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/movement/movement.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, BOARD } from '../../../data/data';
import { createContext, newGameState, type ChoicePending, type SpinPending } from '../../core/core';
import { doMove, payday, resolveMoveSpin, resolveRoute } from './movement';

const make = (era: number) => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 2 });
  s.era = era;
  return { s, c: createContext(s), p: s.players[0] };
};
const main = (era: number) => BOARD.tiles.filter((t) => t.era === era && t.route === 'main');

describe('movement', () => {
  it('1: 월급날 도착', () => {
    const { c, p } = make(1);
    p.tile = BOARD.eraStart[1];
    doMove(c, p, 7);
    expect(p.money).toBeGreaterThanOrEqual(20);
    expect(c.events.some((e) => e.t === 'money' && e.reason === '용돈')).toBe(true);
    expect(c.events.some((e) => e.t === 'land')).toBe(true);
  });
  it('2: 월급날 지나가기', () => {
    const { c, p } = make(1);
    const m = main(1);
    p.tile = m[5].i;
    doMove(c, p, 3);
    expect(c.events.some((e) => e.t === 'money' && e.reason === '용돈')).toBe(true);
    expect(p.tile).toBe(m[8].i);
  });
  it('3·4: 갈림길 선택 후 이어서 이동', () => {
    const { s, c, p } = make(3);
    const br = BOARD.branches.find((b) => b.era === 3)!;
    const before = BOARD.tiles.find((t) => t.next.includes(br.junction) && t.route === 'main')!;
    const before2 = BOARD.tiles.find((t) => t.next.includes(before.i))!;
    p.tile = before2.i;
    doMove(c, p, 5);
    const pend = s.pending as ChoicePending;
    expect(pend.kind).toBe('route');
    expect(pend.remaining).toBe(3);
    expect(c.events.some((e) => e.t === 'junction')).toBe(true);
    expect(c.events.some((e) => e.t === 'land')).toBe(false);
    s.pending = null;
    const loveIdx = pend.options.findIndex((o) => o.route === 'love');
    resolveRoute(c, p, pend, loveIdx);
    expect(p.tile).toBe(br.a[2]);
  });
  it('5: 결혼 STOP 정지', () => {
    const { c, p } = make(4);
    const stop = BOARD.tiles.find((t) => t.stop === 'marriage')!;
    const prev = BOARD.tiles.find((t) => t.next.includes(stop.i))!;
    p.tile = prev.i;
    doMove(c, p, 6);
    expect(p.tile).toBe(stop.i);
  });
  it('6: END 에서 멈춤', () => {
    const { c, p } = make(2);
    const m = main(2);
    p.tile = m[m.length - 3].i;
    doMove(c, p, 10);
    expect(p.tile).toBe(BOARD.eraEnd[2]);
    expect(p.doneEra).toBe(true);
  });
  it('7: 프리랜서 월급', () => {
    const { c, p } = make(4);
    p.job = 'freelancer';
    payday(c, p);
    const sp = c.events.find((e) => e.t === 'spin');
    expect(sp).toMatchObject({ purpose: 'freelance', auto: true });
    expect(p.money).toBe(300 * (sp as { value: number }).value);
  });
  it('8: 연금', () => {
    const { c, p } = make(6);
    p.job = 'office'; p.rank = 1;
    payday(c, p);
    expect(p.money).toBe(360);
  });
  it('9: 더블', () => {
    const { c, p } = make(1);
    p.tile = BOARD.eraStart[1];
    const pend: SpinPending = { type: 'spin', playerId: 'a', purpose: 'move', title: '', double: true };
    resolveMoveSpin(c, p, pend, 4);
    expect(p.tile).toBe(main(1)[8].i);
    expect(c.events.some((e) => e.t === 'msg' && e.text === '더블 카드! 8칸 전진')).toBe(true);
  });
});
