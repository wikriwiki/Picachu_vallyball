/**
 * @pyramid-spec      design/view/stage/stage.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/stage/stage.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FinalShader, sharedMaterials } from '../toolkit/toolkit';

export interface Orbit { az: number; pol: number; dist: number; distGoal: number; }
export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly target: THREE.Vector3;
  readonly orbit: Orbit;
  tween(ms: number, fn: (t: number) => void): Promise<void>;
  onFrame(fn: (time: number, dt: number) => void): void;
  follow(getPos: (() => THREE.Vector3 | null) | null): void;
  lookAt(p: THREE.Vector3): void;
  setDistance(goal: number): void;
  project(p: THREE.Vector3): { x: number; y: number } | null;
  flash(amount: number): void;
  setBlur(v: number): void;
}

export function orbitPosition(t: THREE.Vector3, o: Orbit, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    t.x + Math.sin(o.az) * Math.sin(o.pol) * o.dist,
    t.y + Math.cos(o.pol) * o.dist,
    t.z - Math.cos(o.az) * Math.sin(o.pol) * o.dist,
  );
}

export function clampOrbit(pol: number, dist: number): { pol: number; dist: number } {
  return { pol: Math.max(0.35, Math.min(1.35, pol)), dist: Math.max(10, Math.min(140, dist)) };
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
  const clock = new THREE.Clock();
  const target = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const orbit: Orbit = { az: -0.35, pol: 0.95, dist: 30, distGoal: 30 };
  const tweens: { t0: number; dur: number; fn: (t: number) => void; resolve: () => void }[] = [];
  const frames: ((time: number, dt: number) => void)[] = [];
  let followFn: (() => THREE.Vector3 | null) | null = null;
  let flashV = 0;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.45, 0.93));
  const finalPass = new ShaderPass(FinalShader);
  composer.addPass(finalPass);
  composer.addPass(new OutputPass());

  let drag: { x: number; y: number; az: number; pol: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, az: orbit.az, pol: orbit.pol };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    orbit.az = drag.az - (e.clientX - drag.x) * 0.006;
    orbit.pol = clampOrbit(drag.pol - (e.clientY - drag.y) * 0.005, orbit.distGoal).pol;
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.distGoal = clampOrbit(orbit.pol, orbit.distGoal * (1 + Math.sign(e.deltaY) * 0.12)).dist;
  }, { passive: false });

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    (finalPass.uniforms.uResolution.value as THREE.Vector2).set(w * pr, h * pr);
  };
  resize();
  window.addEventListener('resize', resize);

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.elapsedTime;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const t = Math.min(1, (time - tw.t0) / tw.dur);
      tw.fn(t);
      if (t >= 1) { tweens.splice(i, 1); tw.resolve(); }
    }
    if (followFn) { const p = followFn(); if (p) goal.set(p.x, 0, p.z); }
    const k = 1 - Math.pow(0.02, dt);
    target.lerp(goal, k);
    orbit.dist += (orbit.distGoal - orbit.dist) * k;
    orbitPosition(target, orbit, camera.position);
    camera.lookAt(target.x, target.y + 1, target.z);
    for (const m of sharedMaterials) if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    for (const f of frames) f(time, dt);
    if (flashV > 0) flashV = Math.max(0, flashV - dt * 1.5);
    finalPass.uniforms.uFlash.value = flashV;
    composer.render(dt);
  });

  return {
    scene, camera, target, orbit,
    tween: (ms, fn) => new Promise((resolve) => { tweens.push({ t0: clock.elapsedTime, dur: Math.max(0.001, ms / 1000), fn, resolve }); }),
    onFrame: (fn) => { frames.push(fn); },
    follow: (fn) => { followFn = fn; },
    lookAt: (p) => { followFn = null; goal.copy(p); },
    setDistance: (g) => { orbit.distGoal = g; },
    project: (p) => {
      const v = p.clone().project(camera);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight };
    },
    flash: (a) => { flashV = a; },
    setBlur: (v) => { finalPass.uniforms.uBlur.value = v; },
  };
}
