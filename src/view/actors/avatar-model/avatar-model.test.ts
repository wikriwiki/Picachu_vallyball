/**
 * @pyramid-spec      design/view/actors/avatar-model/avatar-model.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/avatar-model/avatar-model.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildAvatar, buildCar, buildPeg, setAvatarAge } from './avatar-model';

const hairOf = (g: THREE.Group) => ((g.userData.hairMaterial as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).getHex();

describe('avatar-model', () => {
  it('1: 기본 아바타', () => {
    const g = buildAvatar({});
    expect(g).toBeInstanceOf(THREE.Group);
    expect(g.userData.head).toBeTruthy();
  });
  it('2: 나이', () => {
    const g = buildAvatar({ hair: '#4a3020' });
    setAvatarAge(g, 0);
    expect(g.scale.x).toBe(0.55);
    expect(hairOf(g)).toBe(0x4a3020);
    setAvatarAge(g, 6);
    expect(g.scale.x).toBe(1);
    expect(hairOf(g)).toBe(0xdddddd);
  });
  it('3: 3 → 4', () => {
    const g = buildAvatar({ hair: '#4a3020' });
    setAvatarAge(g, 3); expect(g.scale.x).toBe(0.92);
    setAvatarAge(g, 4); expect(g.scale.x).toBe(1); expect(hairOf(g)).toBe(0x4a3020);
  });
  it('4: 작은 핀', () => { expect(buildPeg(0xff0000, true).scale.x).toBe(0.72); });
  it('5: 자동차', () => { expect(buildCar(0x00ff00).children.length).toBe(6); });
});
