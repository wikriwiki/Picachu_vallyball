/**
 * @pyramid-spec      design/engine/core/core.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/core/core.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../data/data';
import { createContext, newGameState } from './core';

const opts = { players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }, { id: 'b', name: 'B', avatar: { ...AVATAR_DEFAULT }, cpu: true }], seed: 42 };

describe('core 통합', () => {
  it('같은 시드면 같은 초기 상태', () => {
    expect(JSON.stringify(newGameState(opts))).toBe(JSON.stringify(newGameState(opts)));
  });
  it('JSON 왕복해도 같다', () => {
    const s = newGameState(opts);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('컨텍스트를 이어 만들어도 난수 수열이 이어진다', () => {
    const s1 = newGameState(opts);
    const c1 = createContext(s1);
    const whole = [c1.rnd(), c1.rnd(), c1.rnd(), c1.rnd()];
    const s2 = newGameState(opts);
    const a = createContext(s2);
    const part = [a.rnd(), a.rnd()];
    const b = createContext(s2);
    part.push(b.rnd(), b.rnd());
    expect(part).toEqual(whole);
  });
});
