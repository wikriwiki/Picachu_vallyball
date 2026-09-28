/**
 * @pyramid-spec      design/view/toolkit/surfaces/surfaces.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/surfaces/surfaces.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sharedMaterials } from '../toon/toon';
import { buildingMaterial, roadMaterial, tileMaterial } from './surfaces';

describe('surfaces', () => {
  it('1: 건물 옵션', () => {
    const m = buildingMaterial(0xffffff, { win: [1, 2], brick: true });
    expect((m.uniforms.uWin.value as THREE.Vector2).toArray()).toEqual([1, 2]);
    expect(m.uniforms.uBrick.value).toBe(1);
    expect(m.uniforms.uFloor0.value).toBe(0.5);
  });
  it('2: 창 없음', () => { expect((buildingMaterial().uniforms.uWin.value as THREE.Vector2).toArray()).toEqual([0, 0]); });
  it('3: 칸 재질', () => {
    const m = tileMaterial(new THREE.Texture(), new THREE.Vector2(6, 6));
    expect(m.uniforms.uActive.value).toBe(-1);
    expect((m.uniforms.uTileHalf.value as THREE.Vector2).toArray()).toEqual([1.3, 1.3]);
    expect(sharedMaterials.has(m)).toBe(true);
  });
  it('4: 도로', () => { expect(roadMaterial().uniforms.uSpecular.value).toBe(0); });
});
