/**
 * @pyramid-spec      design/client/display/sound/sound.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/sound/sound.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { createSound, type AudioContextLike } from './sound';

function fakeAudio() {
  const freqs: number[] = [];
  const param = { setValueAtTime: (v: number) => { freqs.push(v); }, exponentialRampToValueAtTime: () => {} };
  class AC implements AudioContextLike {
    state = 'running'; currentTime = 0; destination = {};
    resume() {}
    createOscillator() { return { type: '', frequency: { setValueAtTime: (v: number) => freqs.push(v), exponentialRampToValueAtTime: () => {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect() {} }; }
  }
  void param;
  return { AC, freqs };
}
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };

describe('sound', () => {
  it('1: lucky 5음', () => {
    const { AC, freqs } = fakeAudio();
    createSound({ AudioContext: AC, storage: mem() }).lucky();
    expect(freqs).toEqual([784, 988, 1175, 1568, 1976]);
  });
  it('2: 음소거', () => {
    const { AC, freqs } = fakeAudio();
    const st = mem();
    const s = createSound({ AudioContext: AC, storage: st });
    expect(s.toggle()).toBe(true);
    expect(st.m.get('life.mute')).toBe('1');
    s.tick();
    expect(freqs.length).toBe(0);
  });
  it('3: 오디오 없음', () => { expect(() => createSound({ storage: mem() }).ding()).not.toThrow(); });
  it('4: era 쉼표 제외 6음', () => {
    const { AC, freqs } = fakeAudio();
    createSound({ AudioContext: AC, storage: mem() }).era();
    expect(freqs.length).toBe(6);
  });
});
