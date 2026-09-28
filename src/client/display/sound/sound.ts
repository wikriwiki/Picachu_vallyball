/**
 * @pyramid-spec      design/client/display/sound/sound.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/sound/sound.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
export const MUTE_KEY = 'life.mute';

export interface Sound {
  readonly muted: boolean;
  toggle(): boolean;
  unlock(): void;
  tick(): void; hop(): void; ding(): void; money(): void; lose(): void; lucky(): void;
  love(): void; card(): void; era(): void; fanfare(): void; turn(): void;
}

type Osc = { type: string; frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): void; start(t: number): void; stop(t: number): void };
type Gain = { gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void }; connect(n: unknown): void };
export interface AudioContextLike { state: string; currentTime: number; destination: unknown; resume(): unknown; createOscillator(): Osc; createGain(): Gain; }

interface ToneOpts { type?: string; vol?: number; delay?: number; slide?: number; }

export function createSound(deps: { AudioContext?: new () => AudioContextLike; storage?: Pick<Storage, 'getItem' | 'setItem'> } = {}): Sound {
  const storage = () => deps.storage ?? globalThis.localStorage;
  let muted = false;
  try { muted = storage().getItem(MUTE_KEY) === '1'; } catch { /* 무시 */ }
  let ac: AudioContextLike | null = null;
  const ctx = (): AudioContextLike | null => {
    if (!ac) {
      try {
        const AC = deps.AudioContext ?? ((globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext);
        if (!AC) return null;
        ac = new AC();
      } catch { return null; }
    }
    try { if (ac.state === 'suspended') ac.resume(); } catch { /* 무시 */ }
    return ac;
  };
  const tone = (freq: number, dur: number, o: ToneOpts = {}) => {
    if (muted || !freq) return;
    const a = ctx();
    if (!a) return;
    try {
      const t = a.currentTime + (o.delay ?? 0);
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * o.slide, t + dur);
      g.gain.setValueAtTime(o.vol ?? 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(a.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* 무시 */ }
  };
  const seq = (fs: number[], step: number, o: ToneOpts) => fs.forEach((f, i) => tone(f, step * 1.4, { ...o, delay: i * step }));
  return {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { storage().setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* 무시 */ }
      return muted;
    },
    unlock() { ctx(); },
    tick: () => tone(1400, 0.03, { type: 'square', vol: 0.04 }),
    hop: () => tone(520, 0.08, { type: 'triangle', vol: 0.06, slide: 1.6 }),
    ding: () => seq([988, 1319], 0.08, { type: 'triangle', vol: 0.12 }),
    money: () => seq([1047, 1319, 1568], 0.06, { type: 'square', vol: 0.05 }),
    lose: () => seq([392, 330, 262], 0.12, { type: 'sawtooth', vol: 0.05 }),
    lucky: () => seq([784, 988, 1175, 1568, 1976], 0.07, { type: 'triangle', vol: 0.1 }),
    love: () => seq([659, 784, 1047, 988], 0.12, { type: 'sine', vol: 0.12 }),
    card: () => seq([880, 1320], 0.07, { type: 'square', vol: 0.05 }),
    era: () => seq([523, 659, 784, 1047, 0, 784, 1047], 0.13, { type: 'triangle', vol: 0.12 }),
    fanfare: () => seq([523, 523, 523, 698, 0, 880, 784, 1047], 0.14, { type: 'square', vol: 0.07 }),
    turn: () => tone(660, 0.12, { type: 'sine', vol: 0.08 }),
  };
}
