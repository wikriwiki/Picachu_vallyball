/**
 * @pyramid-spec      design/view/actors/confetti/confetti.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/confetti/confetti.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { particleMaterial } from '../../toolkit/toolkit';

export const CONFETTI_COUNT = 260;
export const CONFETTI_COLORS: readonly number[] = [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8, 0xff922b];

export function confettiAttributes(rand: () => number): { vel: Float32Array; color: Float32Array; seed: Float32Array } {
  const vel = new Float32Array(CONFETTI_COUNT * 3);
  const color = new Float32Array(CONFETTI_COUNT * 3);
  const seed = new Float32Array(CONFETTI_COUNT);
  const c = new THREE.Color();
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const a = rand() * Math.PI * 2;
    const sp = 2 + rand() * 6;
    vel.set([Math.cos(a) * sp, 7 + rand() * 8, Math.sin(a) * sp], i * 3);
    c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    color.set([c.r, c.g, c.b], i * 3);
    seed[i] = rand();
  }
  return { vel, color, seed };
}

export function createConfetti(stage: { scene: THREE.Scene; onFrame(fn: (t: number) => void): void }, rand: () => number = Math.random): { burst(pos: THREE.Vector3): void } {
  const { vel, color, seed } = confettiAttributes(rand);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CONFETTI_COUNT * 3), 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = particleMaterial();
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  stage.scene.add(pts);
  let now = 0;
  stage.onFrame((t) => { now = t; mat.uniforms.uTime.value = t; });
  return {
    burst(pos) {
      (mat.uniforms.uOrigin.value as THREE.Vector3).copy(pos).add(new THREE.Vector3(0, 2, 0));
      mat.uniforms.uStart.value = now;
    },
  };
}
