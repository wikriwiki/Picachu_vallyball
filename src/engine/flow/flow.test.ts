/**
 * @pyramid-spec      design/engine/flow/flow.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/flow/flow.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../data/data';
import { createContext, newGameState, type ChoicePending, type Mode } from '../core/core';
import { startGame } from './flow';

const make = (mode: Mode) => newGameState({ players: [0, 1].map((i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 4, mode });

describe('flow 통합', () => {
  it('full 모드는 첫 플레이어의 이동 룰렛부터', () => {
    const s = make('full');
    const c = createContext(s);
    startGame(c);
    expect(s.pending).toMatchObject({ type: 'spin', purpose: 'move', playerId: 'p0' });
  });
  it('adult 모드는 진로 → 직업 선택부터', () => {
    const s = make('adult');
    const c = createContext(s);
    startGame(c);
    expect((s.pending as ChoicePending).kind).toBe('career');
    expect(s.queue.map((q) => q.kind)).toEqual(['job', 'career', 'job']);
  });
});
