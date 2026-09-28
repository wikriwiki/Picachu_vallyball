/**
 * @pyramid-spec      design/view/city/fill/fill.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/fill/fill.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD } from '../../../data/data';
import type { CityCtx } from '../city-ctx';
import { blockCells, fillCity } from './fill';

const ctx = (over: Partial<CityCtx> = {}): CityCtx => ({
  scene: new THREE.Scene(),
  env: { island: { cx: 0, cz: 50, hx: 60, hz: 80, r: 22 }, subIslands: [], terrainHeight: () => 0, boardOut: () => 0, nearestTile: () => [100, BOARD.eraStart[0]] },
  board: { tilePos: [], tileHeading: [], setActiveTile() {} },
  rng: () => 0.5, occupied: [], updaters: [], rows: 3, zMin: -10.5, zMax: 52.5, roadZs: [-10.5, 10.5, 31.5, 52.5], side: 38,
  tileNear: () => false, ...over,
});

describe('fill', () => {
  it('1: 블록 구간', () => {
    expect(blockCells(38)).toEqual([[-34.8, -17.8], [-12.2, -2.8], [2.8, 12.2], [17.8, 34.8]]);
  });
  it('2: 인스턴싱 메시 추가', () => {
    const c = ctx();
    expect(() => fillCity(c, () => 100)).not.toThrow();
    expect(c.scene.children.some((o) => o instanceof THREE.InstancedMesh)).toBe(true);
  });
  it('3: 모두 막히면 아무것도 없음', () => {
    const c = ctx({ occupied: [{ x0: -1000, x1: 1000, z0: -1000, z1: 1000 }], env: { ...ctx().env, island: { cx: 0, cz: 0, hx: 0, hz: 0, r: 0 } } });
    fillCity(c, () => 100);
    expect(c.scene.children.length).toBe(0);
  });
});
