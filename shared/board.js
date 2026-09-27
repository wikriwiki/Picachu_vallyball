// 보드 구성 (서버·클라이언트 공통, 결정적 생성)
import { ERAS } from './data.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEIGHTS = {
  baby: { event: 6, lucky: 2, choice: 2, hiyari: 1, card: 1 },
  elem: { event: 6, lucky: 2, love: 1, hiyari: 2, choice: 2, card: 2 },
  middle: { event: 5, lucky: 2, love: 2, hiyari: 2, choice: 2, card: 2 },
  high: { event: 5, lucky: 2, love: 2, hiyari: 2, choice: 2, card: 2 },
  adult1: { event: 5, lucky: 2, love: 2, hiyari: 3, choice: 2, card: 2, challenge: 3, baby: 1 },
  adult2: { event: 5, lucky: 2, love: 1, hiyari: 3, choice: 2, card: 2, challenge: 3, baby: 2 },
  final: { event: 6, lucky: 2, hiyari: 3, choice: 2, card: 1, love: 1 },
};
const PAYDAY_EVERY = { baby: 0, elem: 7, middle: 7, high: 7, adult1: 5, adult2: 5, final: 6 };
// 시대별 고정 STOP 칸 (시대 내 인덱스)
const STOPS = { adult1: { 22: 'marriage' }, adult2: { 16: 'house' } };

function pick(rng, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[0][0];
}

export function buildBoard() {
  const rng = mulberry(20231006);
  const tiles = [];
  const eraStart = [];
  const eraEnd = [];
  ERAS.forEach((era, ei) => {
    eraStart.push(tiles.length);
    let prev = null;
    for (let k = 0; k < era.len; k++) {
      let type;
      let stop = null;
      if (k === 0) type = 'start';
      else if (k === era.len - 1) type = ei === ERAS.length - 1 ? 'goal' : 'end';
      else if (STOPS[era.id] && STOPS[era.id][k]) { type = 'stop'; stop = STOPS[era.id][k]; }
      else if (PAYDAY_EVERY[era.id] && k % PAYDAY_EVERY[era.id] === 0) type = 'payday';
      else {
        do { type = pick(rng, WEIGHTS[era.id]); } while (type === prev && type !== 'event');
      }
      prev = type;
      tiles.push({ i: tiles.length, era: ei, k, type, stop });
    }
    eraEnd.push(tiles.length - 1);
  });
  return { tiles, eraStart, eraEnd };
}

export const BOARD = buildBoard();
