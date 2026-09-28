/**
 * @pyramid-spec      design/view/city/islands/islands.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/islands/islands.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CityCtx } from '../city-ctx';
import type { SubIsland } from '../../environment/environment';
import { decorateIslands, ringTreeSpots } from './islands';

const ctx = (subIslands: SubIsland[]) => ({
  scene: new THREE.Scene(), updaters: [] as unknown[],
  env: { subIslands },
} as unknown as CityCtx);

describe('islands', () => {
  it('1: 둘레 나무 자리', () => {
    const s = ringTreeSpots(16, 14);
    expect(s.length).toBeLessThan(14);
    for (const [x, z] of s) { expect(Math.abs(x)).toBeLessThanOrEqual(13.5); expect(z > 6 && Math.abs(x) < 8).toBe(false); }
  });
  it('2: 섬 3개 장식', () => {
    const isl = (id: SubIsland['id'], cz: number): SubIsland => ({ id, cx: 120, cz, hx: 16, hz: 14, r: 9 });
    const c = ctx([isl('countryside', 30), isl('casino', 100), isl('shrine', 170)]);
    decorateIslands(c);
    expect(c.scene.children.length).toBe(3);
    expect(c.updaters.length).toBe(1);
  });
  it('3: 섬 없음', () => {
    const c = ctx([]);
    decorateIslands(c);
    expect(c.scene.children.length).toBe(0);
  });
});
