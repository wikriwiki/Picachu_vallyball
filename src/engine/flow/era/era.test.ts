/**
 * @pyramid-spec      design/engine/flow/era/era.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/era/era.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, BOARD } from '../../../data/data';
import { createContext, newGameState, type ChoicePending, type Mode } from '../../core/core';
import { nextEra, resolveCareer, resolveClub } from './era';

const make = (era: number, mode: Mode = 'full') => {
  const s = newGameState({ players: [0, 1].map((i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 2, mode });
  s.era = era;
  return { s, c: createContext(s) };
};

describe('era', () => {
  it('1: 다음 시대', () => {
    const { s, c } = make(1);
    nextEra(c);
    expect(s.era).toBe(2);
    expect(s.players.every((p) => p.tile === BOARD.eraStart[2])).toBe(true);
    expect(c.events.filter((e) => e.t === 'era').length).toBe(1);
    expect(c.events.filter((e) => e.t === 'warp').length).toBe(2);
    expect(s.queue.map((q) => q.kind)).toEqual(['club', 'club']);
  });
  it('2: 고등학생 큐 순서', () => {
    const { s, c } = make(2);
    s.players[1].partner = { id: 'x', affinity: 0 };
    nextEra(c);
    expect(s.queue.map((q) => `${q.kind}:${q.playerId}`)).toEqual(['club:p0', 'crush:p0', 'club:p1']);
  });
  it('3: 어린이 모드 종료', () => {
    const { s, c } = make(3, 'kids');
    nextEra(c);
    expect(s.phase).toBe('ended');
  });
  it('4: 어른 전반 큐', () => {
    const { s, c } = make(3);
    nextEra(c);
    expect(s.queue.map((q) => q.kind).slice(0, 2)).toEqual(['career', 'job']);
  });
  it('5: 은퇴 메시지', () => {
    const { c } = make(5);
    nextEra(c);
    expect(c.events.filter((e) => e.t === 'msg' && e.text.startsWith('은퇴!')).length).toBe(2);
  });
  it('6: 대학 진학', () => {
    const { s, c } = make(4);
    const p = s.players[0];
    resolveCareer(c, p, {} as ChoicePending, 0);
    expect(p.college).toBe(true);
    expect([p.notes, p.money, p.stats.int, p.stats.sen]).toEqual([1, 200, 17, 9]);
  });
  it('7: 귀가부', () => {
    const { s, c } = make(2);
    const p = s.players[0];
    resolveClub(c, p, {} as ChoicePending, 3);
    expect(p.club).toBe('home');
    expect([p.stats.int, p.stats.phy, p.stats.sen, p.money]).toEqual([9, 9, 9, 100]);
  });
});
