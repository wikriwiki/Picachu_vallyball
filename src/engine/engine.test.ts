/**
 * @pyramid-spec      design/engine/engine.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/engine/engine.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, createRng } from '../data/data';
import { RuleError, applyAction, cpuAction, createGame, type GameState, type Mode } from './engine';

const seeds = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: true }));

function play(mode: Mode, seed: number, n = 4, decisionSeed = seed) {
  const rand = createRng(decisionSeed);
  let { state } = createGame({ players: seeds(n), mode, seed });
  const trace: string[] = [];
  const eras = new Set<number>([state.era]);
  let steps = 0;
  while (state.phase === 'playing') {
    const a = cpuAction(state, rand)!;
    const r = applyAction(state, state.pending!.playerId, a);
    state = r.state;
    eras.add(state.era);
    trace.push(JSON.stringify(r.events));
    for (const p of state.players) if (p.money < 0) throw new Error('negative money');
    if (++steps > 20000) throw new Error('too long');
  }
  return { state, trace, eras };
}

describe('engine 통합', () => {
  it('같은 시드·같은 조작이면 매 단계가 같다', () => {
    const a = play('full', 123, 2);
    const b = play('full', 123, 2);
    expect(a.trace).toEqual(b.trace);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('applyAction 은 입력 상태를 바꾸지 않는다', () => {
    const { state } = createGame({ players: seeds(2), seed: 1 });
    const snap = JSON.stringify(state);
    applyAction(state, state.pending!.playerId, { type: 'spin', power: 0.5 });
    expect(JSON.stringify(state)).toBe(snap);
  });

  for (const mode of ['full', 'adult', 'kids'] as Mode[]) {
    it(`${mode} 모드 CPU 4명 60판이 모두 끝난다`, () => {
      for (let g = 0; g < 60; g++) {
        const { state } = play(mode, 1000 + g);
        expect(state.phase).toBe('ended');
        expect(state.result).not.toBeNull();
      }
    }, 120000);
  }

  it('kids 는 고등학생 뒤 바로 결과, adult 는 어른 전반에서 시작', () => {
    const k = play('kids', 7);
    expect(Math.max(...k.eras)).toBe(3);
    const a = createGame({ players: seeds(1), mode: 'adult', seed: 7 });
    expect(a.state.era).toBe(4);
  });

  it('결과 순위와 합계', () => {
    const { state } = play('full', 99);
    const res = state.result!;
    for (const r of res.rows) expect(r.total).toBe(r.items.reduce((s, x) => s + x.amount, 0));
    const totals = res.ranking.map((pid) => res.rows.find((r) => r.pid === pid)!.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('잘못된 조작은 RuleError 이고 상태는 그대로', () => {
    const { state } = createGame({ players: seeds(2), seed: 3 });
    const other = state.players.find((p) => p.id !== state.pending!.playerId)!.id;
    const snap = JSON.stringify(state);
    expect(() => applyAction(state, other, { type: 'spin', power: 0 })).toThrow(RuleError);
    expect(() => applyAction(state, state.pending!.playerId, { type: 'choose', index: 0 })).toThrow(RuleError);
    expect(JSON.stringify(state)).toBe(snap);
  });

  it('full 모드 1인 게임은 시대 0→6 을 모두 지난다', () => {
    const { eras, state } = play('full', 5, 1);
    expect([...eras].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect((state as GameState).players[0].finished).toBe(true);
  });
});
