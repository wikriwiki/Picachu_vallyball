/**
 * @pyramid-spec      design/view/toolkit/fx/fx.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/fx/fx.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FinalShader, ROULETTE_COLORS, particleMaterial, rouletteMaterial, waterMaterial } from './fx';

describe('fx', () => {
  it('1: 물 유니폼', () => {
    const m = waterMaterial();
    expect((m.uniforms.uIsl.value as unknown[]).length).toBe(4);
    expect((m.uniforms.uIslR.value as unknown[]).length).toBe(4);
  });
  it('2: 룰렛', () => {
    const m = rouletteMaterial(new THREE.Texture());
    expect(m.uniforms.uHighlight.value).toBe(-1);
    expect(m.fragmentShader).toContain('vec3 segColor');
  });
  it('3: 룰렛 색', () => { expect(ROULETTE_COLORS.length).toBe(10); });
  it('4: 후처리', () => { expect(FinalShader.uniforms.uFlash.value).toBe(0); });
  it('5: 입자', () => {
    const m = particleMaterial();
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
  });
});
