/**
 * @pyramid-spec      design/engine/flow/turn/turn.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/turn/turn.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../../data/data';
import { createContext, newGameState, type ChoicePending } from '../../core/core';
import { advance, endTurn } from './turn';

const make = (n: number) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 2 });
  return { s, c: createContext(s) };
};

describe('turn', () => {
  it('1: 차례 시작', () => {
    const { s, c } = make(1);
    advance(c);
    expect(c.events[0]).toMatchObject({ t: 'turn', pid: 'p0' });
    expect(s.pending).toMatchObject({ type: 'spin', purpose: 'move' });
    expect(s.turnActive).toBe(true);
  });
  it('2: 큐의 선택부터', () => {
    const { s, c } = make(1);
    s.era = 2;
    s.queue.push({ kind: 'club', playerId: 'p0' });
    advance(c);
    expect((s.pending as ChoicePending).kind).toBe('club');
    expect(s.queue).toEqual([]);
  });
  it('3: 턴 수가 다하면 다음 시대', () => {
    const { s, c } = make(2);
    s.round = 1; s.turn = 1; s.turnActive = true;
    endTurn(c);
    expect([s.turn, s.round === 0, s.era]).toEqual([0, true, 1]);
  });
  it('4: 전원 도착이면 다음 시대', () => {
    const { s, c } = make(2);
    s.era = 1; s.turn = 0; s.turnActive = true;
    s.players.forEach((p) => { p.doneEra = true; });
    endTurn(c);
    expect(s.era).toBe(2);
    expect(s.turn).toBe(0);
  });
  it('5: 도착한 사람은 건너뛴다', () => {
    const { s, c } = make(2);
    s.players[0].doneEra = true;
    advance(c);
    expect(c.events.find((e) => e.t === 'turn')).toMatchObject({ pid: 'p1' });
  });
  it('6: 마지막 시대 전원 GOAL', () => {
    const { s, c } = make(2);
    s.era = 6; s.turnActive = true;
    s.players.forEach((p) => { p.finished = true; });
    endTurn(c);
    expect(s.phase).toBe('ended');
  });
});
