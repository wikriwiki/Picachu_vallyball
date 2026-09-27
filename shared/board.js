// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
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

// 칸 가중치 (docs/ADR.md §12.1). 하트 칸은 고등학생부터 등장 [원작]
const WEIGHTS = {
  baby: { star1: 7, star2: 2, star3: 1, hiyari: 1, choice: 2, card: 1 },
  elem: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  middle: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  high: { star1: 6, star2: 3, star3: 1, love: 2, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  adult1: { star1: 5, star2: 3, star3: 1, love: 2, hiyari: 2, ghost: 1, choice: 2, card: 1, challenge: 3, baby: 1 },
  adult2: { star1: 5, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1, challenge: 3, baby: 2 },
  final: { star1: 6, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1 },
};
const PAYDAY_EVERY = { baby: 0, elem: 7, middle: 7, high: 7, adult1: 5, adult2: 5, final: 6 };
// 시대별 고정 STOP 칸 (시대 내 인덱스)
const STOPS = { adult1: { 22: 'marriage' }, adult2: { 16: 'house' } };

// 가중치 비율대로 칸 개수를 정확히 배분(최대 나머지 방식) 후 시드 셔플
function quota(weights, n) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const raw = entries.map(([k, w]) => [k, (w / total) * n]);
  const counts = raw.map(([k, v]) => [k, Math.floor(v), v - Math.floor(v)]);
  let left = n - counts.reduce((sum, c) => sum + c[1], 0);
  [...counts].sort((x, y) => y[2] - x[2]).forEach((c) => { if (left > 0) { c[1] += 1; left -= 1; } });
  return counts.flatMap(([k, c]) => Array(c).fill(k));
}

function shuffleNoRepeat(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // 같은 종류(별 Lv1 제외)가 연달아 오지 않도록 교환
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1] || arr[i] === 'star1') continue;
      const j = arr.findIndex((v, k) => v !== arr[i] && k !== i && arr[k - 1] !== arr[i] && arr[k + 1] !== arr[i]);
      if (j >= 0) [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr;
}

export function buildBoard() {
  const rng = mulberry(20231006);
  const tiles = [];
  const eraStart = [];
  const eraEnd = [];
  ERAS.forEach((era, ei) => {
    eraStart.push(tiles.length);
    const fixed = [];
    for (let k = 0; k < era.len; k++) {
      if (k === 0) fixed[k] = ['start', null];
      else if (k === era.len - 1) fixed[k] = [ei === ERAS.length - 1 ? 'goal' : 'end', null];
      else if (STOPS[era.id] && STOPS[era.id][k]) fixed[k] = ['stop', STOPS[era.id][k]];
      else if (PAYDAY_EVERY[era.id] && k % PAYDAY_EVERY[era.id] === 0) fixed[k] = ['payday', null];
    }
    const free = [];
    for (let k = 0; k < era.len; k++) if (!fixed[k]) free.push(k);
    const bag = shuffleNoRepeat(rng, quota(WEIGHTS[era.id], free.length));
    free.forEach((k, i) => { fixed[k] = [bag[i], null]; });
    for (let k = 0; k < era.len; k++) tiles.push({ i: tiles.length, era: ei, k, type: fixed[k][0], stop: fixed[k][1] });
    eraEnd.push(tiles.length - 1);
  });
  return { tiles, eraStart, eraEnd };
}

export const BOARD = buildBoard();
