/**
 * @pyramid-spec      design/engine/tiles/travel/travel.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/travel/travel.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, BOARD, type Tile } from '../../../data/data';
import { createContext, newGameState, type ChoicePending, type SpinPending } from '../../core/core';
import { onSubTile, onTravel, resolveBet, resolveBetChoice, resolveJackpot, resolveOmikuji, resolvePray, resolveTravel } from './travel';

const make = () => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 2 });
  s.era = 4;
  return { s, c: createContext(s), p: s.players[0] };
};
const spin = (purpose: SpinPending['purpose'], amount?: number): SpinPending => ({ type: 'spin', playerId: 'a', purpose, title: '', amount });

describe('travel', () => {
  it('1: 여행 떠나기', () => {
    const { s, c, p } = make();
    const t = BOARD.tiles.find((x) => x.type === 'travel' && x.sub === 'countryside')!;
    p.tile = t.i;
    onTravel(c, p, t);
    resolveTravel(c, p, s.pending as ChoicePending, 0);
    expect(p.tile).toBe(BOARD.subStart.countryside);
    expect(p.subReturn).toBe(t.ret);
    expect(c.events.some((e) => e.t === 'warp' && e.fly)).toBe(true);
  });
  it('2: 귀환', () => {
    const { c, p } = make();
    p.subReturn = 100;
    onSubTile(c, p, { type: 'return' } as Tile);
    expect(p.tile).toBe(100);
    expect(p.subReturn).toBeNull();
  });
  it('3: 수확', () => {
    const { c, p } = make();
    onSubTile(c, p, { type: 'farm' } as Tile);
    expect(p.money).toBe(500);
  });
  it('4: 베팅', () => {
    const { s, c, p } = make();
    resolveBetChoice(c, p, { type: 'choice', kind: 'bet', playerId: 'a', title: '', options: [{ label: '', amount: 1000 }, { label: '', amount: 3000 }] }, 1);
    resolveBet(c, p, s.pending as SpinPending, 6);
    expect(p.money).toBe(6000);
  });
  it('5: 운세 뽑기', () => {
    const { c, p } = make();
    resolveOmikuji(c, p, spin('omikuji'), 1);
    expect(p.fortune).toBe(1);
    resolveOmikuji(c, p, spin('omikuji'), 10);
    expect(p.fortune).toBe(6);
  });
  it('6: 기도 — 룰렛 승진형은 랭크업', () => {
    const { c, p } = make();
    p.job = 'baseball';
    resolvePray(c, p, spin('pray'), 9);
    expect(p.fortune).toBe(5);
    expect(p.rank).toBe(1);
  });
  it('7: 기도 — 회사원은 랭크 그대로', () => {
    const { c, p } = make();
    p.job = 'office';
    resolvePray(c, p, spin('pray'), 9);
    expect(p.rank).toBe(0);
  });
  it('8: 잭팟', () => {
    const { c, p } = make();
    resolveJackpot(c, p, spin('jackpot'), 7);
    expect(p.money).toBe(7000);
  });
});
