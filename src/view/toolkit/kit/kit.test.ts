/**
 * @pyramid-spec      design/view/toolkit/kit/kit.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/kit/kit.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { box, easeInOut, outlined, sdRoundBox, textSprite } from './kit';

const mat = new THREE.MeshBasicMaterial();
const geo = new THREE.BoxGeometry(1, 1, 1);

describe('kit', () => {
  it('1·2: sdRoundBox', () => {
    expect(sdRoundBox(0, 0, 10, 5, 2)).toBeCloseTo(-5);
    expect(sdRoundBox(12, 0, 10, 5, 2)).toBeCloseTo(2);
  });
  it('3: easeInOut', () => { expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]); });
  it('4: 외곽선', () => {
    const g = new THREE.Group();
    const m = outlined(g, geo, mat);
    expect(g.children.length).toBe(1);
    expect(m.children.length).toBe(1);
  });
  it('5: 외곽선 없음', () => {
    const g = new THREE.Group();
    expect(outlined(g, geo, mat, { outline: false }).children.length).toBe(0);
  });
  it('6: box 위치', () => {
    const g = new THREE.Group();
    expect(box(g, 2, 4, 2, mat, 1, 0, 3).position.toArray()).toEqual([1, 2, 3]);
  });
  it('7: 캔버스 없는 환경의 글자 스프라이트', () => {
    expect(textSprite('가나')).toBeInstanceOf(THREE.Sprite);
  });
});
