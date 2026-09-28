/**
 * @pyramid-spec      design/view/stage/stage.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/stage/stage.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clampOrbit, orbitPosition } from './stage';

describe('stage', () => {
  it('1: 정면', () => {
    const v = orbitPosition(new THREE.Vector3(), { az: 0, pol: Math.PI / 2, dist: 10, distGoal: 10 }, new THREE.Vector3());
    expect(v.x).toBeCloseTo(0); expect(v.y).toBeCloseTo(0); expect(v.z).toBeCloseTo(-10);
  });
  it('2: 옆', () => {
    const v = orbitPosition(new THREE.Vector3(1, 2, 3), { az: Math.PI / 2, pol: Math.PI / 2, dist: 10, distGoal: 10 }, new THREE.Vector3());
    expect(v.x).toBeCloseTo(11); expect(v.y).toBeCloseTo(2); expect(v.z).toBeCloseTo(3);
  });
  it('3: 자르기', () => {
    expect(clampOrbit(2, 5)).toEqual({ pol: 1.35, dist: 10 });
    expect(clampOrbit(0.1, 500)).toEqual({ pol: 0.35, dist: 140 });
  });
});
