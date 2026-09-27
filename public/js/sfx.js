// WebAudio 합성 효과음
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('life.muted') === '1'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0 } = {}) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const seq = (notes, step = 0.1, opts = {}) => notes.forEach((f, i) => f && tone(f, step * 1.6, { ...opts, delay: i * step }));

export const sfx = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('life.muted', muted ? '1' : '0'); } catch { /* ignore */ }
    return muted;
  },
  unlock() { ac(); },
  tick() { tone(1400, 0.03, { type: 'square', vol: 0.04 }); },
  hop() { tone(520, 0.08, { type: 'triangle', vol: 0.06, slide: 1.6 }); },
  ding() { seq([988, 1319], 0.08, { type: 'triangle', vol: 0.12 }); },
  money() { seq([1047, 1319, 1568], 0.06, { type: 'square', vol: 0.05 }); },
  lose() { seq([392, 330, 262], 0.12, { type: 'sawtooth', vol: 0.05 }); },
  lucky() { seq([784, 988, 1175, 1568, 1976], 0.07, { type: 'triangle', vol: 0.1 }); },
  love() { seq([659, 784, 1047, 988], 0.12, { type: 'sine', vol: 0.12 }); },
  card() { seq([880, 1320], 0.07, { type: 'square', vol: 0.05 }); },
  era() { seq([523, 659, 784, 1047, 0, 784, 1047], 0.13, { type: 'triangle', vol: 0.12 }); },
  fanfare() { seq([523, 523, 523, 698, 0, 880, 784, 1047], 0.14, { type: 'square', vol: 0.07 }); },
  turn() { tone(660, 0.12, { type: 'sine', vol: 0.08 }); },
};
