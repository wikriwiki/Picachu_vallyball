// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 3D 룰렛 (1~10) — 별도 캔버스, 각속도 모션 블러 셰이더
import * as THREE from 'three';
import { rouletteMaterial, toonMaterial } from './shaders.js';
import { outlined } from './avatar.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
const POINTER = -Math.PI / 2; // 포인터 위치(아래쪽)

function numbersTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 10; k++) {
    const a = ((k + 0.5) / 10) * TAU;
    const x = S / 2 + Math.cos(a) * 0.76 * (S / 2);
    const y = S / 2 - Math.sin(a) * 0.76 * (S / 2);
    g.save();
    g.translate(x, y);
    g.rotate(-a - Math.PI / 2); // 숫자 윗부분이 중심을 향함 → 아래 포인터 칸이 똑바로 읽힘
    g.font = 'bold 170px sans-serif';
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowOffsetY = 6;
    g.fillText(String(k + 1), 0, 0);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Roulette {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, -1.9, 6.6);
    this.camera.lookAt(0, 0, 0);
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 2, 4);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    this.mat = rouletteMaterial(numbersTexture());
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 96), this.mat);
    this.scene.add(this.disc);
    // 원판 두께(흰 테두리) + 가운데 팔각 허브 + 테두리 핀 — 원판과 함께 회전
    const white = toonMaterial(0xffffff, { specular: 0.5, rim: 0.3 });
    const rimM = outlined(this.disc, new THREE.CylinderGeometry(1.52, 1.55, 0.22, 72), white, { thickness: 0.015 });
    rimM.rotation.x = Math.PI / 2;
    rimM.position.z = -0.12;
    const hub = outlined(this.disc, new THREE.CylinderGeometry(0.28, 0.34, 0.36, 8), white, { thickness: 0.015 });
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.18;
    const cap = outlined(this.disc, new THREE.CylinderGeometry(0.2, 0.28, 0.08, 8), white, { thickness: 0.012 });
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.4;
    const pegG = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const peg = outlined(this.disc, pegG, white, { thickness: 0.01 });
      peg.rotation.x = Math.PI / 2;
      peg.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.1);
    }
    // 포인터: 아래쪽 흰 막대 + 공 (원작처럼 아래 칸을 가리킴)
    const ptr = new THREE.Group();
    const stick = outlined(ptr, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), white, { thickness: 0.012 });
    stick.position.y = -0.25;
    const ball = outlined(ptr, new THREE.SphereGeometry(0.14, 16, 12), white, { thickness: 0.015 });
    ball.position.y = -0.55;
    ptr.position.set(0, -1.42, 0.25);
    this.scene.add(ptr);
    this.pointer = ptr;
    this.angle = POINTER - 0.5 * (TAU / 10);
    this.vel = 0.3;
    this.mode = 'idle';
    this.lastSeg = -1;
    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.canvas.clientWidth || 200;
    const h = this.canvas.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // 누르고 있는 동안 가속
  charge(power) {
    this.mode = 'charge';
    this.vel = 2 + power * 22;
    this.mat.uniforms.uHighlight.value = -1;
  }
  release() {
    if (this.mode === 'charge' || this.mode === 'idle') this.mode = 'free';
  }

  // 서버 결과값으로 감속 정지
  spinTo(value, quick = false) {
    const k = value - 1;
    const target = POINTER - (k + 0.5) * (TAU / 10);
    const start = this.angle;
    const turns = quick ? 1 : 3 + Math.random();
    // 칸 중앙 근처(칸 폭의 ±30%)에 멈춤
    const jitter = (Math.random() - 0.5) * 0.6 * (TAU / 10);
    let finalAngle = target + jitter;
    while (finalAngle > start - turns * TAU) finalAngle -= TAU;
    this.mat.uniforms.uHighlight.value = -1;
    this.mode = 'decel';
    const dur = quick ? 0.9 : 2.4;
    return new Promise((resolve) => {
      this.anim = { start, end: finalAngle, t0: this.clock.elapsedTime, dur, resolve, k };
    });
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const prev = this.angle;
    if (this.mode === 'idle') {
      this.angle -= 0.25 * dt;
    } else if (this.mode === 'charge' || this.mode === 'free') {
      this.angle -= this.vel * dt;
    } else if (this.mode === 'decel' && this.anim) {
      const a = this.anim;
      const u = Math.min(1, (t - a.t0) / a.dur);
      const e = 1 - Math.pow(1 - u, 3);
      this.angle = a.start + (a.end - a.start) * e;
      if (u >= 1) {
        this.mode = 'stopped';
        this.mat.uniforms.uHighlight.value = a.k;
        this.anim = null;
        sfx.ding();
        a.resolve();
      }
    }
    const w = Math.abs(this.angle - prev) / Math.max(dt, 1e-3);
    this.mat.uniforms.uBlur.value = Math.min(0.9, w * 0.018);
    this.mat.uniforms.uAngle.value = this.angle;
    this.mat.uniforms.uTime.value = t;
    this.disc.rotation.z = this.angle;
    // 칸 경계 통과 시 틱 소리 + 포인터 흔들림
    const seg = Math.floor(((POINTER - this.angle) / TAU) * 10);
    if (seg !== this.lastSeg) {
      if (this.mode !== 'idle' && this.mode !== 'stopped') { sfx.tick(); this.pointer.rotation.z = 0.35; }
      this.lastSeg = seg;
    }
    this.pointer.rotation.z += (0 - this.pointer.rotation.z) * Math.min(1, dt * 14);
    this.renderer.render(this.scene, this.camera);
  }

  idle() { this.mode = 'idle'; }
}
