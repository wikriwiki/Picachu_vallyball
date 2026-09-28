/**
 * @pyramid-spec      design/view/city/landmarks/landmarks.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/landmarks/landmarks.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILDERS, DISTRICTS, landmarkCandidates, type LandmarkType } from './landmarks';

describe('landmarks', () => {
  it('1: 후보 순서', () => {
    const c = landmarkCandidates(0, 22);
    expect(c.length).toBe(10);
    expect(c[0]).toEqual([0, 25.75, 1]);
    expect(c[1]).toEqual([0, 16.25, -1]);
    expect(c[2]).toEqual([-12, 25.75, 1]);
  });
  it('2: 레인 안쪽으로 자르기', () => { expect(landmarkCandidates(40, 0)[0][0]).toBe(23); });
  it('3: 7개 시대', () => { expect(Object.keys(DISTRICTS).length).toBe(7); });
  it('4: 모든 형상 생성', () => {
    for (const k of Object.keys(BUILDERS) as LandmarkType[]) {
      const g = new THREE.Group();
      expect(() => BUILDERS[k](g)).not.toThrow();
      expect(g.children.length).toBeGreaterThan(0);
    }
  });
});
