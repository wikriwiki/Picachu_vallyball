/**
 * @pyramid-spec      design/view/actors/preview/preview.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/preview/preview.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import type { Avatar } from '../../../data/data';
import { buildAvatar } from '../avatar-model/avatar-model';

export interface AvatarPreview { setAvatar(avatar: Avatar): void; setActive(active: boolean): void; }

export function previewSway(ms: number): number { return Math.sin(ms / 900) * 0.6; }

export function createAvatarPreview(canvas: HTMLCanvasElement, avatar: Avatar): AvatarPreview {
  const w = canvas.clientWidth || 150; const h = canvas.clientHeight || 190;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  cam.position.set(0, 1.4, 6);
  cam.lookAt(0, 1.05, 0);
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 3, 4);
  scene.add(light);
  let fig = buildAvatar(avatar);
  scene.add(fig);
  let active = true;
  renderer.setAnimationLoop((t) => {
    if (!active) return;
    fig.rotation.y = previewSway(t);
    renderer.render(scene, cam);
  });
  return {
    setAvatar(av) { scene.remove(fig); fig = buildAvatar(av); scene.add(fig); },
    setActive(b) { active = b; },
  };
}
