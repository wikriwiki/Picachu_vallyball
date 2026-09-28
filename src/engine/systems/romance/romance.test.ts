/**
 * @pyramid-spec      design/engine/systems/romance/romance.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/romance/romance.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../../data/data';
import { createContext, newGameState, type ChoicePending, type SpinPending } from '../../core/core';
import {
  makeCrushChoice, marry, onDestinyTile, onLoveTile, onMarriageStop, proposeNeed, resolveDestiny, resolvePropose, setPartner, topStat,
} from './romance';

const make = (n = 1, era = 3) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 11 });
  s.era = era;
  s.partners.forEach((c, i) => { c.stars = [1, 2, 3, 1, 2, 3, 1, 2, 3, 4, 5, 4][i]; });
  return { s, c: createContext(s), p: s.players[0] };
};

describe('romance', () => {
  it('1: topStat', () => {
    const { p } = make();
    p.stats = { int: 30, phy: 30, sen: 10 };
    expect(topStat(p)).toBe('int');
  });
  it('2: proposeNeed', () => {
    const { p } = make();
    const need = (a: number) => { p.partner = { id: 'x', affinity: a }; return proposeNeed(p); };
    expect([need(60), need(80), need(100), need(0)]).toEqual([5, 3, 2, 10]);
  });
  it('3: 관심 있는 사람 선택지', () => {
    const { c, p } = make();
    expect(makeCrushChoice(c, p).options.length).toBe(4);
  });
  it('4: 첫 만남', () => {
    const { c, p } = make();
    onLoveTile(c, p);
    expect(p.partner?.affinity).toBe(10);
  });
  it('5: 어른 데이트와 프러포즈 제안', () => {
    const { s, c, p } = make(1, 4);
    const cand = s.partners.find((x) => x.stars === 1 && x.personality === 'int')!;
    p.stats = { int: 30, phy: 10, sen: 10 };
    setPartner(c, p, cand, 50);
    p.money = 1000;
    onLoveTile(c, p);
    expect(p.partner?.affinity).toBe(79);
    expect(p.money).toBe(800);
    expect((s.pending as ChoicePending).kind).toBe('propose');
  });
  it('6: ★5 성격 불일치 고등', () => {
    const { s, c, p } = make();
    const cand = s.partners.find((x) => x.stars === 5)!;
    p.stats = cand.personality === 'int' ? { int: 1, phy: 50, sen: 1 } : { int: 50, phy: 1, sen: 1 };
    setPartner(c, p, cand, 0);
    onLoveTile(c, p);
    expect(p.partner?.affinity).toBe(9);
    expect(p.money).toBe(0);
  });
  it('7: 프러포즈 룰렛', () => {
    const { s, c, p } = make(1, 4);
    setPartner(c, p, s.partners[0], 60);
    const pend: SpinPending = { type: 'spin', playerId: 'p0', purpose: 'propose', need: 5, title: '' };
    resolvePropose(c, p, pend, 4);
    expect(p.partner?.affinity).toBe(40);
    resolvePropose(c, p, pend, 5);
    expect(p.spouse).toBe(s.partners[0].name);
  });
  it('8: 결혼 보상', () => {
    const { s, c, p } = make(2, 4);
    const cand = s.partners.find((x) => x.stars === 2 && x.personality === 'phy')!;
    setPartner(c, p, cand, 70);
    marry(c, p);
    expect(s.players[1].money).toBe(700); // 어음 1장 발행 후 700
    expect(p.money).toBe(300 + 2000);
    expect(p.cards).toContain('gym');
    expect(cand.takenBy).toBe('p0');
  });
  it('9: 결혼 STOP 즉석 소개팅', () => {
    const { s, c, p } = make(1, 4);
    onMarriageStop(c, p);
    expect(p.partner?.affinity).toBe(30);
    expect((s.pending as SpinPending).need).toBe(8);
  });
  it('10: 운명의 하트로 상대 바꾸기', () => {
    const { s, c, p } = make(1, 4);
    const old = s.partners[0];
    setPartner(c, p, old, 40);
    onDestinyTile(c, p);
    resolveDestiny(c, p, s.pending as ChoicePending, 0);
    expect(p.partner?.affinity).toBe(20);
    expect(p.partner?.id).not.toBe(old.id);
    expect(old.takenBy).toBeNull();
  });
});
