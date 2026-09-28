/**
 * @pyramid-spec      design/engine/core/context/context.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/context/context.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../../data/data';
import { createContext } from './context';
import { RuleError, type GameState } from '../types/types';

const st = (rng = 5, players: { id: string; name: string }[] = []) => ({ rng, log: [] as string[], players } as unknown as GameState);

describe('context', () => {
  it('1: rnd 가 상태 시드로 수열을 낸다', () => {
    const s = st(5);
    const c = createContext(s);
    const a = [c.rnd(), c.rnd(), c.rnd()];
    const r = createRng(5);
    expect(a).toEqual([r(), r(), r()]);
    expect(s.rng).not.toBe(5);
  });
  it('2: rint 범위', () => {
    const c = createContext(st(1));
    for (let i = 0; i < 1000; i++) { const v = c.rint(10); expect(Number.isInteger(v) && v >= 0 && v < 10).toBe(true); }
  });
  it('3: 기록 40줄 유지', () => {
    const s = st();
    s.log = Array.from({ length: 39 }, (_, i) => `l${i}`);
    const c = createContext(s);
    c.log('a'); c.log('b');
    expect(s.log.length).toBe(40);
    expect(s.log[0]).toBe('l1');
  });
  it('4: msg', () => {
    const s = st(1, [{ id: 'p', name: '가' }]);
    const c = createContext(s);
    c.msg(c.player('p'), '안녕', 'lucky');
    expect(c.events[0]).toEqual({ t: 'msg', pid: 'p', text: '안녕', kind: 'lucky' });
    expect(s.log.at(-1)).toBe('가: 안녕');
  });
  it('5: msg null', () => {
    const s = st();
    const c = createContext(s);
    c.msg(null, '시대');
    expect(c.events[0]).toEqual({ t: 'msg', pid: null, text: '시대', kind: 'info' });
    expect(s.log.at(-1)).toBe('시대');
  });
  it('6: 없는 플레이어', () => { expect(() => createContext(st()).player('x')).toThrow(RuleError); });
});
