// 아바타 (치비 캐릭터) + 자동차 말 생성
import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from './shaders.js';

const OUTLINE = outlineMaterial(0x2a2238, 0.03);
const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function outlined(parent, geometry, material, { outline = true, shadow = true, thickness } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  if (outline) {
    const o = new THREE.Mesh(geometry, thickness ? outlineMaterial(0x2a2238, thickness) : OUTLINE);
    m.add(o);
  }
  return m;
}

export function buildAvatar(av = {}, opts = {}) {
  const g = new THREE.Group();
  const skin = toonMaterial(av.skin || '#f5d0b0', { rim: 0.25 });
  const shirt = toonMaterial(av.shirt || '#ff6b6b');
  const pants = toonMaterial(av.pants || '#364fc7');
  const hairM = toonMaterial(av.hair || '#4a3020', { specular: 0.5 });
  const dark = toonMaterial(0x222222, { rim: 0 });
  const cheek = toonMaterial(0xff9aa8, { rim: 0 });

  // 다리
  const legG = geo('leg', () => new THREE.CapsuleGeometry(0.13, 0.25, 4, 10));
  const l1 = outlined(g, legG, pants); l1.position.set(-0.14, 0.26, 0);
  const l2 = outlined(g, legG, pants); l2.position.set(0.14, 0.26, 0);
  // 몸통
  const body = outlined(g, geo('body', () => new THREE.CapsuleGeometry(0.3, 0.3, 6, 16)), shirt);
  body.position.y = 0.75;
  // 팔
  const armG = geo('arm', () => new THREE.CapsuleGeometry(0.09, 0.3, 4, 8));
  const a1 = outlined(g, armG, shirt); a1.position.set(-0.38, 0.8, 0); a1.rotation.z = 0.35;
  const a2 = outlined(g, armG, shirt); a2.position.set(0.38, 0.8, 0); a2.rotation.z = -0.35;
  // 머리
  const head = new THREE.Group();
  head.position.y = 1.45;
  g.add(head);
  outlined(head, geo('head', () => new THREE.SphereGeometry(0.46, 24, 18)), skin);
  // 눈
  const eyeG = geo('eye', () => new THREE.SphereGeometry(0.06, 10, 8));
  const face = av.face | 0;
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(eyeG, dark);
    e.position.set(0.15 * sx, 0.02, 0.41);
    e.scale.set(1, face === 1 ? 0.45 : 1.25, 0.6);
    head.add(e);
    const c = new THREE.Mesh(eyeG, cheek);
    c.position.set(0.27 * sx, -0.12, 0.35);
    c.scale.set(1.2, 0.7, 0.4);
    head.add(c);
  }
  if (face === 2) {
    const ring = geo('glass', () => new THREE.TorusGeometry(0.1, 0.018, 6, 16));
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(ring, dark);
      r.position.set(0.15 * sx, 0.02, 0.44);
      head.add(r);
    }
  }
  // 머리카락
  const hs = av.hairStyle | 0;
  const cap = outlined(head, geo('cap', () => new THREE.SphereGeometry(0.49, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairM);
  cap.rotation.x = -0.25;
  cap.position.z = -0.03;
  if (hs === 1) {
    const cone = geo('spike', () => new THREE.ConeGeometry(0.13, 0.35, 8));
    for (let i = 0; i < 5; i++) {
      const s = outlined(head, cone, hairM);
      const a = (i / 4 - 0.5) * 2.0;
      s.position.set(Math.sin(a) * 0.3, 0.42, Math.cos(a) * 0.05 - 0.05);
      s.rotation.z = -a * 0.5;
    }
  } else if (hs === 2) {
    const back = outlined(head, geo('long', () => new THREE.CapsuleGeometry(0.34, 0.4, 6, 12)), hairM);
    back.position.set(0, -0.2, -0.2);
    back.scale.set(1.3, 1, 0.7);
  } else if (hs === 3) {
    const bun = outlined(head, geo('bun', () => new THREE.SphereGeometry(0.2, 14, 10)), hairM);
    bun.position.set(0, 0.5, -0.12);
  }
  g.userData = { head, hairM, body, legs: [l1, l2], arms: [a1, a2], baseHair: new THREE.Color(av.hair || '#4a3020') };
  return g;
}

export function setAvatarAge(fig, era) {
  // 0 아기 ~ 6 노년
  const scale = [0.55, 0.7, 0.82, 0.92, 1, 1, 1][era] ?? 1;
  fig.scale.setScalar(scale);
  const hair = fig.userData.hairM.uniforms.uColor.value;
  if (era >= 6) hair.set(0xdddddd);
  else hair.copy(fig.userData.baseHair);
}

export function buildCar(color) {
  const g = new THREE.Group();
  const bodyM = toonMaterial(color, { specular: 0.6, rim: 0.4 });
  const white = toonMaterial(0xffffff);
  const tire = toonMaterial(0x2b2b2b, { rim: 0.1 });
  const body = outlined(g, geo('carBody', () => {
    const shape = new THREE.Shape();
    const w = 0.7, l = 1.05, r = 0.3;
    shape.moveTo(-w + r, -l); shape.lineTo(w - r, -l); shape.quadraticCurveTo(w, -l, w, -l + r);
    shape.lineTo(w, l - r); shape.quadraticCurveTo(w, l, w - r, l); shape.lineTo(-w + r, l);
    shape.quadraticCurveTo(-w, l, -w, l - r); shape.lineTo(-w, -l + r); shape.quadraticCurveTo(-w, -l, -w + r, -l);
    const eg = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 });
    eg.rotateX(-Math.PI / 2);
    eg.translate(0, 0.22, 0);
    return eg;
  }), bodyM);
  // 핀 구멍 판
  const plate = outlined(g, geo('carPlate', () => new THREE.BoxGeometry(1.1, 0.06, 1.5)), white, { outline: false });
  plate.position.y = 0.66;
  const wheel = geo('wheel', () => { const c = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16); c.rotateZ(Math.PI / 2); return c; });
  for (const [x, z] of [[-0.72, 0.62], [0.72, 0.62], [-0.72, -0.62], [0.72, -0.62]]) {
    const w = outlined(g, wheel, tire);
    w.position.set(x, 0.22, z);
  }
  g.userData.body = body;
  return g;
}

// 배우자/아이 핀
export function buildPeg(color, small = false) {
  const g = new THREE.Group();
  const m = toonMaterial(color, { rim: 0.4 });
  const skin = toonMaterial(0xf5d0b0);
  const b = outlined(g, geo('pegBody', () => new THREE.CapsuleGeometry(0.12, 0.22, 4, 10)), m, { thickness: 0.02 });
  b.position.y = 0.2;
  const h = outlined(g, geo('pegHead', () => new THREE.SphereGeometry(0.14, 12, 10)), skin, { thickness: 0.02 });
  h.position.y = 0.5;
  if (small) g.scale.setScalar(0.72);
  return g;
}
