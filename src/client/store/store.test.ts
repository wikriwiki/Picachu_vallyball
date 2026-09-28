/**
 * @pyramid-spec      design/client/store/store.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/store/store.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import type { PublicState } from '../../engine/engine';
import { createStore } from './store';

const st = (over: Partial<PublicState> = {}) => ({
  phase: 'playing', seq: 3, players: [{ id: 'a' }, { id: 'b' }],
  pending: { type: 'spin', playerId: 'a', purpose: 'move', title: '' }, ...over,
} as unknown as PublicState);

describe('store', () => {
  it('1: 초기값', () => {
    const s = createStore();
    expect([s.get('me'), s.get('room'), s.get('state'), s.get('shown'), s.get('busy'), s.get('queued'), s.get('sentSeq'), s.get('resultShown')])
      .toEqual([null, null, null, null, false, 0, -1, false]);
  });
  it('2: 바뀐 키만 알림', () => {
    const s = createStore(); const calls: string[][] = [];
    s.subscribe((c) => calls.push(c));
    s.set({ me: 'a', busy: false });
    expect(calls).toEqual([['me']]);
  });
  it('3: 빈 패치', () => {
    const s = createStore(); let n = 0;
    s.subscribe(() => { n++; });
    s.set({});
    expect(n).toBe(0);
  });
  it('4: 해제', () => {
    const s = createStore(); let n = 0;
    const off = s.subscribe(() => { n++; });
    off(); s.set({ me: 'b' });
    expect(n).toBe(0);
  });
  it('5: 내 대기', () => {
    const s = createStore();
    s.set({ me: 'a', state: st() });
    expect(s.myPending()).toEqual(st().pending);
  });
  it('6: 보낸 뒤', () => {
    const s = createStore();
    s.set({ me: 'a', state: st(), sentSeq: 3 });
    expect(s.myPending()).toBeNull();
  });
  it('7: 조작 불가 조건', () => {
    for (const patch of [{ busy: true }, { queued: 1 }]) {
      const s = createStore(); s.set({ me: 'a', state: st(), ...patch });
      expect(s.myPending()).toBeNull();
    }
    const s1 = createStore(); s1.set({ me: 'b', state: st() }); expect(s1.myPending()).toBeNull();
    const s2 = createStore(); s2.set({ me: 'a', state: st({ phase: 'ended' }) }); expect(s2.myPending()).toBeNull();
  });
  it('8: 초점 — 대기 없으면 나', () => {
    const s = createStore(); s.set({ me: 'b' });
    expect(s.focusPlayer(st({ pending: null })).id).toBe('b');
  });
  it('9: 초점 — 나도 없으면 첫 사람', () => {
    expect(createStore().focusPlayer(st({ pending: null })).id).toBe('a');
  });
  it('10: 초점 — 없는 ID', () => {
    const s = createStore(); s.set({ me: 'b' });
    expect(s.focusPlayer(st({ pending: { type: 'spin', playerId: 'z', purpose: 'move', title: '' } })).id).toBe('b');
  });
});
