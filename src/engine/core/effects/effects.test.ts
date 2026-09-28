/**
 * @pyramid-spec      design/engine/core/effects/effects.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/effects/effects.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, type CardId } from '../../../data/data';
import { newGameState } from '../setup/setup';
import { createContext } from '../context/context';
import { addFortune, addMoney, addStat, applyEffects, collectFromOthers, doublePositive, gainCard } from './effects';

const make = (n = 1, era = 0) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 9 });
  s.era = era;
  return { s, c: createContext(s), p: s.players[0] };
};

describe('effects', () => {
  it('1: 약속어음 자동 발행', () => {
    const { c, p } = make();
    p.money = 100;
    addMoney(c, p, -2500, '지출');
    expect(p.money).toBe(600);
    expect(p.notes).toBe(3);
    expect(c.events).toEqual([{ t: 'money', pid: 'p0', delta: -2500, reason: '지출' }, { t: 'note', pid: 'p0', count: 3, total: 3 }]);
  });
  it('2: 0 원은 이벤트 없음', () => {
    const { c, p } = make();
    addMoney(c, p, 0, 'x');
    expect(c.events).toEqual([]);
  });
  it('3: 능력치 상한', () => {
    const { c, p } = make();
    p.stats.int = 98;
    addStat(c, p, 'int', 5);
    expect(c.events.at(-1)).toMatchObject({ t: 'stat', delta: 2, value: 100 });
    addStat(c, p, 'int', 5);
    expect(c.events.length).toBe(1);
  });
  it('4: 운세 상한', () => {
    const { c, p } = make();
    p.fortune = 6;
    addFortune(c, p, 1);
    expect(c.events).toEqual([]);
  });
  it('5: 손패 가득', () => {
    const { c, p } = make();
    p.cards = ['fixed', 'fixed', 'fixed', 'fixed', 'fixed'];
    gainCard(c, p);
    expect(p.cards.length).toBe(5);
    expect(c.events[0]).toMatchObject({ t: 'msg' });
  });
  it('6: 어른 전에는 승진 카드가 나오지 않는다', () => {
    const { c, p } = make(1, 0);
    const got = new Set<CardId>();
    for (let i = 0; i < 200; i++) { p.cards = []; gainCard(c, p); got.add(p.cards[0]); }
    expect(got.has('rankup')).toBe(false);
  });
  it('7: 축하금 걷기', () => {
    const { s, c } = make(3);
    const [p, a, b] = s.players;
    a.money = 0; b.money = 500;
    collectFromOthers(c, p, 300, '축하');
    expect([a.money, a.notes, b.money, p.money]).toEqual([700, 1, 200, 600]);
  });
  it('8: 어른 무직 월급 단위', () => {
    const { c, p } = make(1, 4);
    applyEffects(c, p, { money: 'salary' });
    expect(p.money).toBe(300);
  });
  it('9: love 효과', () => {
    const { c, p } = make();
    p.partner = { id: 'x', affinity: 50 };
    applyEffects(c, p, { love: 1 });
    expect(p.partner.affinity).toBe(60);
  });
  it('10: doublePositive', () => {
    expect(doublePositive({ int: 5, phy: -2, money: 'salary', fortune: 1 })).toEqual({ int: 10, phy: -2, money: 'salary2', fortune: 1 });
  });
  it('11: gamble', () => {
    const { s, c, p } = make();
    applyEffects(c, p, { gamble: 1000 });
    expect(s.pending).toMatchObject({ type: 'spin', purpose: 'gamble', amount: 1000 });
  });
});
