// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 보드 구성 (서버·클라이언트 공통, 결정적 생성) — 분기 그래프 + 3D 배치 좌표 (docs/ADR.md §12.1)
import { ERAS, SUBMAPS, TRAVEL_SHORTCUT } from './data.js';

// 배치 수치 (docs/ADR.md §12.3)
export const LAYOUT = { STEP: 3.0, ROW: 60, RS: 21, SUB_X: 108, SUB_Z0: 30, SUB_DZ: 70 };

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

// 길별 칸 가중치 (docs/ADR.md §12.1, §6.11). 하트 칸은 고등학생부터 [원작]
export const MAIN_WEIGHTS = {
  baby: { star1: 7, star2: 2, star3: 1, hiyari: 1, choice: 2, card: 1 },
  elem: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  middle: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  high: { star1: 6, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  adult1: { star1: 5, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 1, choice: 2, card: 1, challenge: 2, baby: 1 },
  adult2: { star1: 5, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1, challenge: 2, baby: 2 },
  final: { star1: 6, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1 },
};
export const ROUTE_WEIGHTS = {
  love: { love: 6, star1: 2, star2: 1, hiyari: 1, choice: 1 },
  career: { challenge: 5, star2: 3, star1: 2, card: 1, hiyari: 1, ghost: 1 },
  study: { star2: 4, star1: 3, card: 2, choice: 2, hiyari: 1 },
};

// 가중치 비율대로 칸 개수를 정확히 배분(최대 나머지 방식)
function quota(weights, n) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const counts = entries.map(([k, w]) => { const v = (w / total) * n; return [k, Math.floor(v), v - Math.floor(v)]; });
  let left = n - counts.reduce((sum, c) => sum + c[1], 0);
  [...counts].sort((x, y) => y[2] - x[2]).forEach((c) => { if (left > 0) { c[1] += 1; left -= 1; } });
  return counts.flatMap(([k, c]) => Array(c).fill(k));
}
function shuffleNoRepeat(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1] || arr[i] === 'star1') continue;
      const j = arr.findIndex((v, k) => v !== arr[i] && k !== i && arr[k - 1] !== arr[i] && arr[k + 1] !== arr[i]);
      if (j >= 0) [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  return arr;
}

// 레인(뱀 모양) 위의 점: 직선 레인 + 직각 세로 연결. straight = 현재 직선 레인의 남은 길이(연결 구간이면 0)
export function lanePoint(s) {
  const { ROW, RS } = LAYOUT;
  s = Math.max(0, s);
  const per = ROW + RS;
  const k = Math.floor(s / per);
  const u = s - k * per;
  const dir = k % 2 === 0 ? 1 : -1;
  const z0 = k * RS;
  const xStart = dir === 1 ? -ROW / 2 : ROW / 2;
  if (u < ROW) return { x: xStart + dir * u, z: z0, straight: ROW - u, lane: k };
  return { x: xStart + dir * ROW, z: z0 + (u - ROW), straight: 0, lane: k };
}

export function buildBoard() {
  const { STEP } = LAYOUT;
  const rng = mulberry(20231006);
  const tiles = [];
  const eraStart = [];
  const eraEnd = [];
  const branches = [];
  const add = (props) => {
    const t = { i: tiles.length, type: null, stop: null, route: 'main', next: [], ...props };
    tiles.push(t);
    return t;
  };
  let s = 0;
  let prev = null;
  let branchNo = 0;

  ERAS.forEach((era, ei) => {
    const eraTiles = [];
    let mergeCarry = false; // 직전 분기의 합류 칸이 이미 만들어져 다음 일반 part 의 첫 칸으로 쓰임
    const mainAt = (fixedKind) => {
      const p = lanePoint(s);
      const t = add({ era: ei, x: p.x, z: p.z });
      if (fixedKind) t.fixed = fixedKind;
      if (prev && eraTiles.length) prev.next.push(t.i);
      prev = t;
      eraTiles.push(t);
      s += STEP;
      return t;
    };
    era.path.forEach((part) => {
      if (part.main != null) {
        // part.fixed 의 칸 번호는 합류 칸을 0번으로 센다
        const start = mergeCarry ? 1 : 0;
        for (let k = start; k < part.main; k++) mainAt(part.fixed && part.fixed[k]);
        mergeCarry = false;
        return;
      }
      const L = part.branch;
      // 분기 구간(분기점 ~ 합류점)이 한 직선 레인 안에 들어가야 함: 모자라면 일반 칸을 더 깔아 다음 레인으로
      let guard = 0;
      const fits = () => { const q = lanePoint(s - STEP); return q.straight >= (L + 1) * STEP + 0.01 && q.straight < LAYOUT.ROW; };
      while (!fits()) { mainAt(null); if (++guard > 80) throw new Error('branch layout'); }
      const J = prev;
      const jp = lanePoint(s - STEP);
      const side = branchNo++ % 2 === 0 ? 1 : -1; // 우회로가 레인 위/아래 번갈아
      const a = [];
      const b = [];
      let last = J;
      for (let k = 1; k <= L; k++) {
        const p = lanePoint(s - STEP + k * STEP);
        const t = add({ era: ei, x: p.x, z: p.z, route: part.a });
        last.next.push(t.i); last = t; a.push(t); eraTiles.push(t);
      }
      const aLast = last;
      // 우회로: 옆으로 2칸 → 레인과 나란히 L+1칸 → 돌아오며 1칸 (총 L+4)
      const pts = [[jp.x, jp.z + side * 3], [jp.x, jp.z + side * 6]];
      for (let k = 1; k <= L + 1; k++) { const p = lanePoint(s - STEP + k * STEP); pts.push([p.x, p.z + side * 6]); }
      const mp = lanePoint(s - STEP + (L + 1) * STEP);
      pts.push([mp.x, mp.z + side * 3]);
      last = J;
      for (const [x, z] of pts) {
        const t = add({ era: ei, x, z, route: part.b, detour: side });
        last.next.push(t.i); last = t; b.push(t); eraTiles.push(t);
      }
      const bLast = last;
      s = s - STEP + (L + 1) * STEP;
      prev = aLast;
      const M = mainAt(null);
      bLast.next.push(M.i);
      mergeCarry = true;
      branches.push({ era: ei, junction: J.i, a: a.map((t) => t.i), b: b.map((t) => t.i), merge: M.i, routes: [part.a, part.b] });
    });
    eraStart.push(eraTiles[0].i);
    const last = eraTiles.filter((t) => t.route === 'main').pop();
    eraEnd.push(last.i);
    eraTiles[0].type = 'start';
    last.type = ei === ERAS.length - 1 ? 'goal' : 'end';
    last.next = [];

    // ---- 칸 종류 배정 (docs/ADR.md §12.1) ----
    for (const t of eraTiles) {
      if (t.type || !t.fixed) continue;
      const [kind, arg] = t.fixed.split(':');
      if (kind === 'stop') { t.type = 'stop'; t.stop = arg; }
      if (kind === 'travel') { t.type = 'travel'; t.sub = arg; }
    }
    // 월급날: 일반 길에서 START 로부터 payEvery 칸마다 (일반 길 칸만 셈)
    if (era.payEvery) {
      let d = 0;
      for (const t of eraTiles) {
        if (t.route !== 'main') continue;
        if (!t.type && d > 0 && d % era.payEvery === 0) t.type = 'payday';
        d += 1;
      }
    }
    for (const br of branches.filter((x) => x.era === ei)) {
      const [aRoute, bRoute] = br.routes;
      const mid = (ids) => tiles[ids[Math.floor(ids.length / 2)]];
      if (aRoute === 'love') mid(br.a).type = 'destiny';
      if (bRoute === 'career') mid(br.b).type = 'payday';
      for (const [ids, route] of [[br.a, aRoute], [br.b, bRoute]]) {
        const free = ids.map((i) => tiles[i]).filter((t) => !t.type);
        const bag = shuffleNoRepeat(rng, quota(ROUTE_WEIGHTS[route], free.length));
        free.forEach((t, k) => { t.type = bag[k]; });
      }
    }
    const freeMain = eraTiles.filter((t) => !t.type);
    const bag = shuffleNoRepeat(rng, quota(MAIN_WEIGHTS[era.id], freeMain.length));
    freeMain.forEach((t, k) => { t.type = bag[k]; });
  });

  // ---- 서브맵 (본 섬 동쪽의 작은 섬 3개, 10칸 U자) ----
  const subStart = {};
  Object.entries(SUBMAPS).forEach(([id, sm], si) => {
    const X0 = LAYOUT.SUB_X;
    const Z0 = LAYOUT.SUB_Z0 + si * LAYOUT.SUB_DZ;
    let last = null;
    sm.tiles.forEach((type, k) => {
      const x = k < 5 ? X0 + k * STEP : X0 + (9 - k) * STEP;
      const z = k < 5 ? Z0 : Z0 + 7;
      const t = add({ era: -1, sub: id, x, z, route: 'sub', type });
      if (last) last.next.push(t.i);
      last = t;
      if (k === 0) subStart[id] = t.i;
    });
  });
  // 여행 칸 → 귀환 지점 (일반 길 기준 TRAVEL_SHORTCUT 칸 앞)
  for (const t of tiles) {
    if (t.type !== 'travel') continue;
    let r = t;
    for (let k = 0; k < TRAVEL_SHORTCUT && r.next.length; k++) r = tiles[r.next[0]];
    t.ret = r.i;
  }
  for (const t of tiles) delete t.fixed;
  return { tiles, eraStart, eraEnd, branches, subStart };
}

export const BOARD = buildBoard();

// 현재 칸에서 가장 가까운 월급날까지 칸 수 (분기에서는 가까운 쪽). 서브맵·없으면 null
export function stepsToPayday(i) {
  const start = BOARD.tiles[i];
  if (!start || start.era < 0) return null;
  const seen = new Set([i]);
  let frontier = [i];
  for (let d = 1; d < 300 && frontier.length; d++) {
    const nf = [];
    for (const f of frontier) {
      for (const n of BOARD.tiles[f].next) {
        if (seen.has(n)) continue;
        seen.add(n);
        if (BOARD.tiles[n].type === 'payday') return d;
        nf.push(n);
      }
    }
    frontier = nf;
  }
  return null;
}
