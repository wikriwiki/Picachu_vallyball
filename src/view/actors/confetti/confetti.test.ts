/**
 * @pyramid-spec      design/view/actors/confetti/confetti.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/confetti/confetti.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { confettiAttributes, createConfetti } from './confetti';

describe('confetti', () => {
  it('1: 속도', () => {
    const { vel } = confettiAttributes(() => 0.5);
    expect(vel.length).toBe(780);
    expect(vel[0]).toBeCloseTo(Math.cos(Math.PI) * 5);
    expect(vel[1]).toBeCloseTo(11);
    expect(vel[2]).toBeCloseTo(Math.sin(Math.PI) * 5);
  });
  it('2: 색 순환', () => {
    const { color } = confettiAttributes(() => 0.5);
    expect([color[18], color[19], color[20]]).toEqual([color[0], color[1], color[2]]);
  });
  it('3: 터뜨리기', () => {
    const scene = new THREE.Scene();
    let frame: (t: number) => void = () => {};
    const c = createConfetti({ scene, onFrame: (f) => { frame = f; } }, () => 0.5);
    frame(5);
    c.burst(new THREE.Vector3(1, 0, 1));
    const mat = (scene.children[0] as THREE.Points).material as THREE.ShaderMaterial;
    expect((mat.uniforms.uOrigin.value as THREE.Vector3).toArray()).toEqual([1, 2, 1]);
    expect(mat.uniforms.uStart.value).toBe(5);
  });
});
