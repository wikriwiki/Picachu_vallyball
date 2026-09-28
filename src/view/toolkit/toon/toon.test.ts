/**
 * @pyramid-spec      design/view/toolkit/toon/toon.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/toon/toon.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { outlineMaterial, sharedMaterials, toonMaterial, toonUniforms } from './toon';

describe('toon', () => {
  it('1: toonMaterial 옵션', () => {
    const m = toonMaterial(0xff0000, { rim: 0.1, specular: 0 });
    expect((m.uniforms.uColor.value as THREE.Color).getHex()).toBe(0xff0000);
    expect(m.uniforms.uRimStrength.value).toBe(0.1);
    expect(m.uniforms.uSpecular.value).toBe(0);
    expect(m.lights).toBe(true);
    expect(sharedMaterials.has(m)).toBe(true);
  });
  it('2: toonUniforms', () => {
    const u = toonUniforms({ uX: { value: 1 } });
    expect(u.uX.value).toBe(1);
    expect(u.uFogFar.value).toBe(260);
  });
  it('3: outlineMaterial', () => {
    const m = outlineMaterial();
    expect(m.side).toBe(THREE.BackSide);
    expect(m.uniforms.uThickness.value).toBe(0.035);
    expect(sharedMaterials.has(m)).toBe(false);
  });
});
