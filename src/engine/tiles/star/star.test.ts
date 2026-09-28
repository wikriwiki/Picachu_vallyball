/**
 * @pyramid-spec      design/engine/tiles/star/star.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/star/star.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, EVENTS, STAR3, rngNext, type Tile } from '../../../data/data';
import { createContext, newGameState } from '../../core/core';
import { onStar, onStar3 } from './star';

const tile = (type: 'star1' | 'star2') => ({ type } as Tile);
const make = (era: number, seed = 1) => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 1 });
  s.era = era; s.rng = seed;
  return { s, c: createContext(s), p: s.players[0] };
};
/** 첫 난수가 목표 조건을 만족하는 시드 찾기 */
const seedWhere = (ok: (vals: number[]) => boolean, n: number) => {
  for (let seed = 1; seed < 100000; seed++) {
    const vals: number[] = []; let x = seed;
    for (let i = 0; i < n; i++) { const r = rngNext(x); vals.push(r.value); x = r.seed; }
    if (ok(vals)) return seed;
  }
  throw new Error('no seed');
};

describe('star', () => {
  it('1: 아기 시대 Lv1 은 난수 1번', () => {
    const { s, c, p } = make(0, 3);
    onStar(c, p, tile('star1'));
    expect(rngNext(3).seed).toBe(s.rng);
    expect(EVENTS.baby.map((e) => '★ ' + e.t)).toContain((c.events[0] as { text: string }).text);
  });
  it('2: Lv2 는 좋은 효과 2배', () => {
    const seed = seedWhere((v) => Math.floor(v[0] * 9) === 0, 1); // EVENTS.baby[0] = {int:5}
    const { c, p } = make(0, seed);
    onStar(c, p, tile('star2'));
    expect(p.stats.int).toBe(15);
    expect((c.events[0] as { text: string }).text.startsWith('★★ ')).toBe(true);
  });
  it('3: 어른 운세 보너스', () => {
    const seed = seedWhere((v) => [3, 7].indexOf(Math.floor(v[0] * 12)) < 0 && v[1] < 0.25, 2);
    const { c, p } = make(4, seed);
    p.fortune = 5;
    const before = p.money;
    onStar(c, p, tile('star1'));
    expect(c.events.some((e) => e.t === 'money' && e.delta === 1000)).toBe(true);
    expect(p.money).toBeGreaterThan(before - 1);
  });
  it('4: 운세 보통이면 보정 없음', () => {
    const seed = seedWhere((v) => v[1] < 0.25, 2);
    const { c, p } = make(4, seed);
    p.fortune = 3;
    onStar(c, p, tile('star1'));
    expect(c.events.some((e) => e.t === 'money' && (e.reason === '운세 보너스' || e.reason === '불운'))).toBe(false);
  });
  it('5: Lv3 아이 표', () => {
    const { c, p } = make(2);
    onStar3(c, p);
    expect(STAR3.kid.map((e) => '★★★ ' + e.t)).toContain((c.events[0] as { text: string }).text);
  });
});
