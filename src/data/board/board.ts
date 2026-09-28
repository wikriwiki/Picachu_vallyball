/**
 * @pyramid-spec      design/data/board/board.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/board/board.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { ERAS, type EraId, type RouteId } from '../tables/tables';
import { SUBMAPS, SUBMAP_IDS, TRAVEL_SHORTCUT, type SubmapId, type TileType } from '../tile-types/tile-types';
import { createRng } from '../helpers/helpers';

export interface Tile {
  i: number; era: number; x: number; z: number;
  type: TileType; route: RouteId | 'sub'; next: number[];
  stop?: 'marriage' | 'house'; sub?: SubmapId; ret?: number; detour?: 1 | -1;
}
export interface Branch { era: number; junction: number; a: number[]; b: number[]; merge: number; routes: [RouteId, RouteId]; }
export interface Board { tiles: Tile[]; eraStart: number[]; eraEnd: number[]; branches: Branch[]; subStart: Record<SubmapId, number>; }

export const LAYOUT = { STEP: 3.0, ROW: 60, RS: 21, SUB_X: 108, SUB_Z0: 30, SUB_DZ: 70 } as const;
export const BOARD_SEED = 20231006;

type Weights = Partial<Record<TileType, number>>;
export const MAIN_WEIGHTS: Readonly<Record<EraId, Weights>> = {
  baby: { star1: 7, star2: 2, star3: 1, hiyari: 1, choice: 2, card: 1 },
  elem: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  middle: { star1: 7, star2: 3, star3: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  high: { star1: 6, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 1, choice: 2, card: 1 },
  adult1: { star1: 5, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 1, choice: 2, card: 1, challenge: 2, baby: 1 },
  adult2: { star1: 5, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1, challenge: 2, baby: 2 },
  final: { star1: 6, star2: 3, star3: 1, love: 1, hiyari: 2, ghost: 2, choice: 2, card: 1 },
};
export const ROUTE_WEIGHTS: Readonly<Record<'love' | 'career' | 'study', Weights>> = {
  love: { love: 6, star1: 2, star2: 1, hiyari: 1, choice: 1 },
  career: { challenge: 5, star2: 3, star1: 2, card: 1, hiyari: 1, ghost: 1 },
  study: { star2: 4, star1: 3, card: 2, choice: 2, hiyari: 1 },
};

/** 가중치 비율대로 n 칸을 정확히 배분 (최대 나머지 방식) */
export function quota(weights: Weights, n: number): TileType[] {
  const entries = Object.entries(weights) as [TileType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const counts = entries.map(([k, w]) => { const v = (w / total) * n; return { k, c: Math.floor(v), f: v - Math.floor(v) }; });
  let left = n - counts.reduce((s, c) => s + c.c, 0);
  [...counts].sort((x, y) => y.f - x.f).forEach((c) => { if (left > 0) { c.c += 1; left -= 1; } });
  return counts.flatMap(({ k, c }) => Array<TileType>(c).fill(k));
}

export function shuffleNoRepeat(rng: () => number, arr: TileType[]): TileType[] {
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

/** 뱀 모양 레인 위의 점: 직선 레인 + 직각 세로 연결 */
export function lanePoint(s: number): { x: number; z: number; straight: number; lane: number } {
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

export function buildBoard(): Board {
  const { STEP } = LAYOUT;
  const rng = createRng(BOARD_SEED);
  const tiles: Tile[] = [];
  const eraStart: number[] = [];
  const eraEnd: number[] = [];
  const branches: Branch[] = [];
  const fixedOf = new Map<number, string>();
  const add = (p: { era: number; x: number; z: number; route?: RouteId | 'sub'; type?: TileType; sub?: SubmapId; detour?: 1 | -1 }): Tile => {
    const t: Tile = { i: tiles.length, era: p.era, x: p.x, z: p.z, type: p.type ?? (null as unknown as TileType), route: p.route ?? 'main', next: [] };
    if (p.sub) t.sub = p.sub;
    if (p.detour) t.detour = p.detour;
    tiles.push(t);
    return t;
  };
  let s = 0;
  let prev: Tile | null = null;
  let branchNo = 0;

  ERAS.forEach((era, ei) => {
    const eraTiles: Tile[] = [];
    let mergeCarry = false;
    const mainAt = (fixed?: string): Tile => {
      const p = lanePoint(s);
      const t = add({ era: ei, x: p.x, z: p.z });
      if (fixed) fixedOf.set(t.i, fixed);
      if (prev && eraTiles.length) prev.next.push(t.i);
      prev = t;
      eraTiles.push(t);
      s += STEP;
      return t;
    };
    for (const part of era.path) {
      if ('main' in part) {
        const start = mergeCarry ? 1 : 0;
        for (let k = start; k < part.main; k++) mainAt(part.fixed?.[k]);
        mergeCarry = false;
        continue;
      }
      const L = part.branch;
      let guard = 0;
      const fits = () => { const q = lanePoint(s - STEP); return q.straight >= (L + 1) * STEP + 0.01 && q.straight < LAYOUT.ROW; };
      while (!fits()) { mainAt(); if (++guard > 80) throw new Error('branch layout'); }
      const J = prev as unknown as Tile;
      const jp = lanePoint(s - STEP);
      const side: 1 | -1 = branchNo++ % 2 === 0 ? 1 : -1;
      const a: Tile[] = [];
      const b: Tile[] = [];
      let last: Tile = J;
      for (let k = 1; k <= L; k++) {
        const p = lanePoint(s - STEP + k * STEP);
        const t = add({ era: ei, x: p.x, z: p.z, route: part.a });
        last.next.push(t.i); last = t; a.push(t); eraTiles.push(t);
      }
      const aLast = last;
      const pts: [number, number][] = [[jp.x, jp.z + side * 3], [jp.x, jp.z + side * 6]];
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
      const M = mainAt();
      bLast.next.push(M.i);
      mergeCarry = true;
      branches.push({ era: ei, junction: J.i, a: a.map((t) => t.i), b: b.map((t) => t.i), merge: M.i, routes: [part.a, part.b] });
    }
    eraStart.push(eraTiles[0].i);
    const lastMain = eraTiles.filter((t) => t.route === 'main').pop() as Tile;
    eraEnd.push(lastMain.i);
    eraTiles[0].type = 'start';
    lastMain.type = ei === ERAS.length - 1 ? 'goal' : 'end';
    lastMain.next = [];

    // ① 고정 칸
    for (const t of eraTiles) {
      const f = fixedOf.get(t.i);
      if (t.type || !f) continue;
      const [kind, arg] = f.split(':');
      if (kind === 'stop') { t.type = 'stop'; t.stop = arg as 'marriage' | 'house'; }
      if (kind === 'travel') { t.type = 'travel'; t.sub = arg as SubmapId; }
    }
    // ② 월급날 (일반 길 칸만 셈)
    if (era.payEvery) {
      let d = 0;
      for (const t of eraTiles) {
        if (t.route !== 'main') continue;
        if (!t.type && d > 0 && d % era.payEvery === 0) t.type = 'payday';
        d += 1;
      }
    }
    // ③ 분기 길
    for (const br of branches.filter((x) => x.era === ei)) {
      const [aRoute, bRoute] = br.routes;
      const mid = (ids: number[]) => tiles[ids[Math.floor(ids.length / 2)]];
      if (aRoute === 'love') mid(br.a).type = 'destiny';
      if (bRoute === 'career') mid(br.b).type = 'payday';
      for (const [ids, route] of [[br.a, aRoute], [br.b, bRoute]] as [number[], RouteId][]) {
        const free = ids.map((i) => tiles[i]).filter((t) => !t.type);
        const bag = shuffleNoRepeat(rng, quota(ROUTE_WEIGHTS[route as 'love' | 'career' | 'study'], free.length));
        free.forEach((t, k) => { t.type = bag[k]; });
      }
    }
    // ④ 나머지 일반 칸
    const freeMain = eraTiles.filter((t) => !t.type);
    const bag = shuffleNoRepeat(rng, quota(MAIN_WEIGHTS[era.id], freeMain.length));
    freeMain.forEach((t, k) => { t.type = bag[k]; });
  });

  // 서브맵 섬
  const subStart = {} as Record<SubmapId, number>;
  SUBMAP_IDS.forEach((id, si) => {
    const X0 = LAYOUT.SUB_X;
    const Z0 = LAYOUT.SUB_Z0 + si * LAYOUT.SUB_DZ;
    let last: Tile | null = null;
    SUBMAPS[id].tiles.forEach((type, k) => {
      const x = k < 5 ? X0 + k * STEP : X0 + (9 - k) * STEP;
      const z = k < 5 ? Z0 : Z0 + 7;
      const t = add({ era: -1, sub: id, x, z, route: 'sub', type });
      if (last) last.next.push(t.i);
      last = t;
      if (k === 0) subStart[id] = t.i;
    });
  });
  // 여행 칸 귀환 지점
  for (const t of tiles) {
    if (t.type !== 'travel') continue;
    let r = t;
    for (let k = 0; k < TRAVEL_SHORTCUT && r.next.length; k++) r = tiles[r.next[0]];
    t.ret = r.i;
  }
  return { tiles, eraStart, eraEnd, branches, subStart };
}

export const BOARD: Board = buildBoard();

export function stepsToPayday(i: number): number | null {
  const start = BOARD.tiles[i];
  if (!start || start.era < 0) return null;
  const seen = new Set([i]);
  let frontier = [i];
  for (let d = 1; d < 300 && frontier.length; d++) {
    const nf: number[] = [];
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
