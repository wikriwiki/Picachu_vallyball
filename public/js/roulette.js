// 3D 룰렛 (1~10) — 별도 캔버스, 각속도 모션 블러 셰이더
import * as THREE from 'three';
import { rouletteMaterial, toonMaterial } from './shaders.js';
import { outlined } from './avatar.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;

function numbersTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 10; k++) {
    const a = ((k + 0.5) / 10) * TAU;
    const x = S / 2 + Math.cos(a) * 0.66 * (S / 2);
    const y = S / 2 - Math.sin(a) * 0.66 * (S / 2);
    g.save();
    g.translate(x, y);
    g.rotate(-a + Math.PI / 2);
    g.font = 'bold 150px sans-serif';
    g.lineWidth = 18;
    g.strokeStyle = 'rgba(40,30,70,0.9)';
    g.strokeText(String(k + 1), 0, 0);
    g.fillStyle = '#ffffff';
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
    this.camera.position.set(0, -1.6, 6.2);
    this.camera.lookAt(0, 0, 0);
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 2, 4);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    this.mat = rouletteMaterial(numbersTexture());
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 96), this.mat);
    this.scene.add(this.disc);
    // 받침대 + 포인터
    const base = outlined(this.scene, new THREE.CylinderGeometry(1.62, 1.7, 0.3, 64), toonMaterial(0x6741d9, { specular: 0.6 }));
    base.rotation.x = Math.PI / 2;
    base.position.z = -0.17;
    const ptr = outlined(this.scene, new THREE.ConeGeometry(0.16, 0.42, 3), toonMaterial(0xff2d55, { specular: 0.8 }));
    ptr.rotation.z = Math.PI;
    ptr.position.set(0, 1.62, 0.12);
    this.pointer = ptr;
    this.angle = Math.PI / 2 - 0.5 * (TAU / 10);
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
    const target = Math.PI / 2 - (k + 0.5) * (TAU / 10);
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
    const seg = Math.floor(((Math.PI / 2 - this.angle) / TAU) * 10);
    if (seg !== this.lastSeg) {
      if (this.mode !== 'idle' && this.mode !== 'stopped') { sfx.tick(); this.pointer.rotation.z = Math.PI + 0.35; }
      this.lastSeg = seg;
    }
    this.pointer.rotation.z += (Math.PI - this.pointer.rotation.z) * Math.min(1, dt * 14);
    this.renderer.render(this.scene, this.camera);
  }

  idle() { this.mode = 'idle'; }
}
