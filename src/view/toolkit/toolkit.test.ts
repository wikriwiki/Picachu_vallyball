/**
 * @pyramid-spec      design/view/toolkit/toolkit.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/toolkit/toolkit.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as T from './toolkit';

describe('toolkit 통합', () => {
  it('WebGL 없는 환경에서 모든 재질 생성 함수가 예외 없이 동작', () => {
    expect(() => {
      T.toonMaterial(); T.outlineMaterial(); T.roadMaterial(); T.buildingMaterial(0xffffff, { win: [1, 1] });
      T.tileMaterial(new THREE.Texture(), new THREE.Vector2(6, 6)); T.waterMaterial(); T.skyMaterial();
      T.rouletteMaterial(new THREE.Texture()); T.particleMaterial();
    }).not.toThrow();
  });
  it('캔버스 텍스처는 컨텍스트가 없어도 텍스처를 돌려준다', () => {
    expect(T.canvasTexture(4, 4, () => {})).toBeInstanceOf(THREE.Texture);
  });
});
