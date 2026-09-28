/**
 * @pyramid-spec      design/engine/actions/actions.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/actions/actions.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { AVATAR_DEFAULT } from '../../data/data';
import { RuleError, createContext, newGameState, type Action } from '../core/core';
import { applyInput, spinValue, type Resolvers } from './actions';

const make = () => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 2 });
  const spin = vi.fn(); const choice = vi.fn(); const useCard = vi.fn();
  const r = { spin: new Proxy({}, { get: () => spin }), choice: new Proxy({}, { get: () => choice }), useCard } as unknown as Resolvers;
  return { s, c: createContext(s), r, spin, choice, useCard };
};

describe('actions', () => {
  it('1: spinValue 경계', () => {
    expect([spinValue(0, 0), spinValue(0, 0.999), spinValue(1, 0), spinValue(1, 0.999)]).toEqual([1, 7, 4, 10]);
  });
  it('2: power 자르기', () => { expect([spinValue(5, 0), spinValue(NaN, 0)]).toEqual([4, 1]); });
  it('3: 대기 없음', () => {
    const { c, r } = make();
    expect(() => applyInput(c, 'a', { type: 'spin', power: 0 }, r)).toThrow('차례가 아닙니다');
  });
  it('4: 선택 대기에 룰렛', () => {
    const { s, c, r } = make();
    s.pending = { type: 'choice', kind: 'event', playerId: 'a', title: '', options: [{ label: 'x' }] };
    const rng = s.rng;
    expect(() => applyInput(c, 'a', { type: 'spin', power: 0 }, r)).toThrow(RuleError);
    expect(s.rng).toBe(rng);
  });
  it('5: 지정 룰렛', () => {
    const { s, c, r, spin } = make();
    s.pending = { type: 'spin', playerId: 'a', purpose: 'move', title: '', fixed: 7 };
    const rng = s.rng;
    applyInput(c, 'a', { type: 'spin', power: 0 }, r);
    expect(c.events[0]).toMatchObject({ t: 'spin', value: 7, fixed: true });
    expect(spin.mock.calls[0][3]).toBe(7);
    expect(s.rng).toBe(rng);
  });
  it('6: 선택지 검사', () => {
    const { s, c, r } = make();
    s.pending = { type: 'choice', kind: 'event', playerId: 'a', title: '', options: [{ label: 'x' }, { label: 'y', disabled: true }] };
    expect(() => applyInput(c, 'a', { type: 'choose', index: 1 }, r)).toThrow('조건을 만족하지');
    expect(() => applyInput(c, 'a', { type: 'choose', index: 5 }, r)).toThrow('잘못된 선택');
  });
  it('7: 선택 판정', () => {
    const { s, c, r, choice } = make();
    s.pending = { type: 'choice', kind: 'event', playerId: 'a', title: '', options: [{ label: 'x' }] };
    choice.mockImplementation(() => expect(s.pending).toBeNull());
    applyInput(c, 'a', { type: 'choose', index: 0 }, r);
    expect(c.events[0]).toMatchObject({ t: 'chose', kind: 'event', index: 0, label: 'x' });
    expect(choice).toHaveBeenCalledTimes(1);
  });
  it('8: 끝난 게임', () => {
    const { s, c, r } = make();
    s.phase = 'ended';
    expect(() => applyInput(c, 'a', { type: 'choose', index: 0 } as Action, r)).toThrow('진행 중이 아닙니다');
  });
});
