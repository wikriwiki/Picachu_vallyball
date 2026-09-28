/**
 * @pyramid-spec      design/view/roulette/roulette.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/roulette/roulette.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { canvasTexture, outlined, rouletteMaterial, toonMaterial } from '../toolkit/toolkit';

const TAU = Math.PI * 2;
export const POINTER = -Math.PI / 2;

export interface RouletteView {
  charge(power: number): void;
  release(): void;
  spinTo(value: number, quick?: boolean): Promise<void>;
}

export function stopAngle(value: number, start: number, turns: number, jitter: number): number {
  let a = POINTER - (value - 0.5) * (TAU / 10) + jitter;
  while (a > start - turns * TAU) a -= TAU;
  return a;
}

export function segmentUnderPointer(angle: number): number {
  const s = Math.floor(((POINTER - angle) / TAU) * 10);
  return ((s % 10) + 10) % 10;
}

function numbersTexture(): THREE.Texture {
  const S = 1024;
  return canvasTexture(S, S, (g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k < 10; k++) {
      const a = ((k + 0.5) / 10) * TAU;
      g.save();
      g.translate(S / 2 + Math.cos(a) * 0.76 * (S / 2), S / 2 - Math.sin(a) * 0.76 * (S / 2));
      g.rotate(-a - Math.PI / 2);
      g.font = 'bold 170px sans-serif';
      g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowOffsetY = 6;
      g.fillText(String(k + 1), 0, 0);
      g.restore();
    }
  });
}

export function createRoulette(canvas: HTMLCanvasElement, sounds?: { tick(): void; ding(): void }): RouletteView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, -1.9, 6.6);
  camera.lookAt(0, 0, 0);
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 2, 4);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));
  const mat = rouletteMaterial(numbersTexture());
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 96), mat);
  scene.add(disc);
  const white = toonMaterial(0xffffff, { specular: 0.5, rim: 0.3 });
  const rim = outlined(disc, new THREE.CylinderGeometry(1.52, 1.55, 0.22, 72), white, { thickness: 0.015 });
  rim.rotation.x = Math.PI / 2; rim.position.z = -0.12;
  const hub = outlined(disc, new THREE.CylinderGeometry(0.28, 0.34, 0.36, 8), white, { thickness: 0.015 });
  hub.rotation.x = Math.PI / 2; hub.position.z = 0.18;
  const cap = outlined(disc, new THREE.CylinderGeometry(0.2, 0.28, 0.08, 8), white, { thickness: 0.012 });
  cap.rotation.x = Math.PI / 2; cap.position.z = 0.4;
  const pegG = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    const peg = outlined(disc, pegG, white, { thickness: 0.01 });
    peg.rotation.x = Math.PI / 2;
    peg.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.1);
  }
  const pointer = new THREE.Group();
  const stick = outlined(pointer, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), white, { thickness: 0.012 });
  stick.position.y = -0.25;
  const ball = outlined(pointer, new THREE.SphereGeometry(0.14, 16, 12), white, { thickness: 0.015 });
  ball.position.y = -0.55;
  pointer.position.set(0, -1.42, 0.25);
  scene.add(pointer);

  let angle = POINTER - 0.5 * (TAU / 10);
  let vel = 0.3;
  let mode: 'idle' | 'charge' | 'free' | 'decel' | 'stopped' = 'idle';
  let lastSeg = -1;
  let anim: { start: number; end: number; t0: number; dur: number; k: number; resolve: () => void } | null = null;
  const clock = new THREE.Clock();
  const finish = () => {
    if (!anim) return;
    angle = anim.end;
    mode = 'stopped';
    mat.uniforms.uHighlight.value = anim.k;
    const done = anim.resolve;
    anim = null;
    sounds?.ding();
    done();
  };

  const resize = () => {
    const w = canvas.clientWidth || 200; const h = canvas.clientHeight || 200;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const prev = angle;
    if (mode === 'idle') angle -= 0.25 * dt;
    else if (mode === 'charge' || mode === 'free') angle -= vel * dt;
    else if (mode === 'decel' && anim) {
      const u = Math.min(1, (t - anim.t0) / anim.dur);
      angle = anim.start + (anim.end - anim.start) * (1 - Math.pow(1 - u, 3));
      if (u >= 1) finish();
    }
    const w = Math.abs(angle - prev) / Math.max(dt, 1e-3);
    mat.uniforms.uBlur.value = Math.min(0.9, w * 0.018);
    mat.uniforms.uAngle.value = angle;
    mat.uniforms.uTime.value = t;
    disc.rotation.z = angle;
    const seg = segmentUnderPointer(angle);
    if (seg !== lastSeg) {
      if (mode !== 'idle' && mode !== 'stopped') { sounds?.tick(); pointer.rotation.z = 0.35; }
      lastSeg = seg;
    }
    pointer.rotation.z += (0 - pointer.rotation.z) * Math.min(1, dt * 14);
    renderer.render(scene, camera);
  });

  return {
    charge(power) { mode = 'charge'; vel = 2 + power * 22; mat.uniforms.uHighlight.value = -1; },
    release() { if (mode === 'charge' || mode === 'idle') mode = 'free'; },
    spinTo(value, quick = false) {
      const turns = quick ? 1 : 3 + Math.random();
      const jitter = (Math.random() - 0.5) * 0.6 * (TAU / 10);
      mat.uniforms.uHighlight.value = -1;
      mode = 'decel';
      return new Promise((resolve) => {
        const dur = quick ? 0.9 : 2.4;
        const mine = { start: angle, end: stopAngle(value, angle, turns, jitter), t0: clock.elapsedTime, dur, k: value - 1, resolve };
        anim = mine;
        setTimeout(() => { if (anim === mine) finish(); }, dur * 1000 + 200);
      });
    },
  };
}
