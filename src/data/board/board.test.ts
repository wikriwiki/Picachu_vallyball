/**
 * @pyramid-spec      design/data/board/board.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/board/board.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { BOARD, buildBoard, lanePoint, quota, stepsToPayday } from './board';
import type { TileType } from '../tile-types/tile-types';

const NAME: Record<string, TileType> = {
  START: 'start', END: 'end', GOAL: 'goal', 별1: 'star1', 별2: 'star2', 별3: 'star3', 물방울: 'hiyari', 유령: 'ghost', 하트: 'love',
  '운명의 하트': 'destiny', 선택: 'choice', 카드: 'card', 찬스: 'challenge', 아기: 'baby', 월급: 'payday', STOP: 'stop', 여행: 'travel',
};
const parse = (s: string) => Object.fromEntries(s.split(' · ').map((x) => { const i = x.lastIndexOf(' '); return [NAME[x.slice(0, i)], Number(x.slice(i + 1))]; }));
// 설계 문서 「생성 결과」 표
const EXPECT: [number, string, string][] = [
  [0, 'main', 'START 1 · END 1 · 별1 6 · 별2 2 · 별3 1 · 물방울 1 · 선택 1 · 카드 1'],
  [1, 'main', 'START 1 · END 1 · 별1 10 · 별2 4 · 별3 1 · 물방울 3 · 유령 1 · 선택 3 · 카드 1 · 월급 3'],
  [2, 'main', 'START 1 · END 1 · 별1 10 · 별2 4 · 별3 1 · 물방울 3 · 유령 1 · 선택 3 · 카드 1 · 월급 3'],
  [3, 'main', 'START 1 · END 1 · 별1 7 · 별2 3 · 별3 1 · 물방울 2 · 유령 1 · 하트 1 · 선택 2 · 카드 1 · 월급 3'],
  [3, 'love', '별1 1 · 별2 1 · 물방울 1 · 하트 5 · 운명의 하트 1 · 선택 1'],
  [3, 'study', '별1 4 · 별2 5 · 물방울 1 · 선택 2 · 카드 2'],
  [4, 'main', 'START 1 · END 1 · 별1 18 · 별2 11 · 별3 4 · 물방울 7 · 유령 3 · 하트 4 · 선택 7 · 카드 3 · 찬스 7 · 아기 3 · 월급 3 · STOP 1 · 여행 1'],
  [4, 'love', '별1 5 · 별2 2 · 물방울 2 · 하트 13 · 운명의 하트 2 · 선택 2'],
  [4, 'career', '별1 5 · 별2 8 · 물방울 2 · 유령 2 · 카드 2 · 찬스 13 · 월급 2'],
  [5, 'main', 'START 1 · END 1 · 별1 12 · 별2 7 · 별3 2 · 물방울 5 · 유령 5 · 하트 2 · 선택 5 · 카드 2 · 찬스 5 · 아기 5 · 월급 3 · STOP 1 · 여행 1'],
  [5, 'love', '별1 4 · 별2 2 · 물방울 2 · 하트 12 · 운명의 하트 2 · 선택 2'],
  [5, 'career', '별1 4 · 별2 8 · 물방울 2 · 유령 2 · 카드 2 · 찬스 12 · 월급 2'],
  [6, 'main', 'START 1 · GOAL 1 · 별1 10 · 별2 5 · 별3 2 · 물방울 3 · 유령 3 · 하트 2 · 선택 3 · 카드 1 · 월급 2 · 여행 1'],
];
const counts = (era: number, route: string) => {
  const c: Record<string, number> = {};
  for (const t of BOARD.tiles) if (t.era === era && t.route === route) c[t.type] = (c[t.type] ?? 0) + 1;
  return c;
};

describe('board', () => {
  it('1: 칸 수', () => {
    expect(BOARD.tiles.length).toBe(428);
    expect(BOARD.tiles.filter((t) => t.era >= 0).length).toBe(398);
  });
  it('2: 시대·길별 칸 수', () => {
    const n = (e: number, r: string) => BOARD.tiles.filter((t) => t.era === e && t.route === r).length;
    expect([n(0, 'main'), n(1, 'main'), n(2, 'main'), n(3, 'main'), n(3, 'love'), n(3, 'study')]).toEqual([14, 28, 28, 23, 10, 14]);
    expect([n(4, 'main'), n(4, 'love'), n(4, 'career'), n(5, 'main'), n(5, 'love'), n(5, 'career'), n(6, 'main')]).toEqual([74, 26, 34, 57, 24, 32, 34]);
  });
  it('3: 종류 구성', () => {
    for (const [era, route, s] of EXPECT) expect(counts(era, route)).toEqual(parse(s));
  });
  it('4: next 개수', () => {
    const junctions = new Set(BOARD.branches.map((b) => b.junction));
    for (const t of BOARD.tiles) {
      if (junctions.has(t.i)) expect(t.next.length).toBe(2);
      else if (t.type === 'end' || t.type === 'goal' || t.type === 'return') expect(t.next.length).toBe(0);
      else expect(t.next.length).toBe(1);
    }
  });
  it('5: lanePoint', () => {
    expect(lanePoint(0)).toMatchObject({ x: -30, z: 0 });
    expect(lanePoint(60)).toMatchObject({ x: 30, z: 0, straight: 0 });
    expect(lanePoint(81)).toMatchObject({ x: 30, z: 21 });
  });
  it('6: quota', () => { expect(quota({ star1: 1, star2: 1 }, 3)).toEqual(['star1', 'star1', 'star2']); });
  it('7: 여행 칸 귀환', () => {
    const travels = BOARD.tiles.filter((t) => t.type === 'travel');
    expect(travels.length).toBe(3);
    for (const t of travels) {
      let r = t;
      for (let k = 0; k < 6; k++) r = BOARD.tiles[r.next[0]];
      expect(t.ret).toBe(r.i);
    }
  });
  it('8: 월급날까지', () => { expect(stepsToPayday(BOARD.eraStart[1])).toBe(7); });
  it('9: 결정적', () => { expect(JSON.stringify(buildBoard())).toBe(JSON.stringify(BOARD)); });
});
