/**
 * @pyramid-spec      design/view/actors/avatar-model/avatar-model.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/avatar-model/avatar-model.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { AVATAR_DEFAULT, type Avatar } from '../../../data/data';
import { outlined, toonMaterial } from '../../toolkit/toolkit';

export const AGE_SCALE: readonly number[] = [0.55, 0.7, 0.82, 0.92, 1, 1, 1];

const cache = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, make: () => THREE.BufferGeometry) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key)!; };

export function buildAvatar(av: Partial<Avatar>): THREE.Group {
  const a = { ...AVATAR_DEFAULT, ...av };
  const g = new THREE.Group();
  const skin = toonMaterial(a.skin, { rim: 0.25 });
  const shirt = toonMaterial(a.shirt);
  const pants = toonMaterial(a.pants);
  const hairM = toonMaterial(a.hair, { specular: 0.5 });
  const dark = toonMaterial(0x222222, { rim: 0 });
  const cheek = toonMaterial(0xff9aa8, { rim: 0 });
  const legG = geo('leg', () => new THREE.CapsuleGeometry(0.13, 0.25, 4, 10));
  outlined(g, legG, pants).position.set(-0.14, 0.26, 0);
  outlined(g, legG, pants).position.set(0.14, 0.26, 0);
  outlined(g, geo('body', () => new THREE.CapsuleGeometry(0.3, 0.3, 6, 16)), shirt).position.y = 0.75;
  const armG = geo('arm', () => new THREE.CapsuleGeometry(0.09, 0.3, 4, 8));
  const a1 = outlined(g, armG, shirt); a1.position.set(-0.38, 0.8, 0); a1.rotation.z = 0.35;
  const a2 = outlined(g, armG, shirt); a2.position.set(0.38, 0.8, 0); a2.rotation.z = -0.35;
  const head = new THREE.Group();
  head.position.y = 1.45;
  g.add(head);
  outlined(head, geo('head', () => new THREE.SphereGeometry(0.46, 24, 18)), skin);
  const eyeG = geo('eye', () => new THREE.SphereGeometry(0.06, 10, 8));
  const face = a.face | 0;
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(eyeG, dark); e.position.set(0.15 * sx, 0.02, 0.41); e.scale.set(1, face === 1 ? 0.45 : 1.25, 0.6); head.add(e);
    const c = new THREE.Mesh(eyeG, cheek); c.position.set(0.27 * sx, -0.12, 0.35); c.scale.set(1.2, 0.7, 0.4); head.add(c);
  }
  if (face === 2) {
    const ring = geo('glass', () => new THREE.TorusGeometry(0.1, 0.018, 6, 16));
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(ring, dark); r.position.set(0.15 * sx, 0.02, 0.44); head.add(r); }
  }
  const hs = a.hairStyle | 0;
  const cap = outlined(head, geo('cap', () => new THREE.SphereGeometry(0.49, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), hairM);
  cap.rotation.x = -0.25; cap.position.z = -0.03;
  if (hs === 1) {
    const cone = geo('spike', () => new THREE.ConeGeometry(0.13, 0.35, 8));
    for (let i = 0; i < 5; i++) {
      const s = outlined(head, cone, hairM);
      const ang = (i / 4 - 0.5) * 2.0;
      s.position.set(Math.sin(ang) * 0.3, 0.42, Math.cos(ang) * 0.05 - 0.05);
      s.rotation.z = -ang * 0.5;
    }
  } else if (hs === 2) {
    const back = outlined(head, geo('long', () => new THREE.CapsuleGeometry(0.34, 0.4, 6, 12)), hairM);
    back.position.set(0, -0.2, -0.2); back.scale.set(1.3, 1, 0.7);
  } else if (hs === 3) {
    outlined(head, geo('bun', () => new THREE.SphereGeometry(0.2, 14, 10)), hairM).position.set(0, 0.5, -0.12);
  }
  g.userData = { head, hairMaterial: hairM, baseHair: new THREE.Color(a.hair) };
  return g;
}

export function setAvatarAge(fig: THREE.Group, era: number): void {
  fig.scale.setScalar(AGE_SCALE[era] ?? 1);
  const hair = (fig.userData.hairMaterial as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color;
  if (era >= 6) hair.set(0xdddddd);
  else hair.copy(fig.userData.baseHair as THREE.Color);
}

export function buildCar(color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const body = outlined(g, geo('carBody', () => {
    const shape = new THREE.Shape();
    const w = 0.7; const l = 1.05; const r = 0.3;
    shape.moveTo(-w + r, -l); shape.lineTo(w - r, -l); shape.quadraticCurveTo(w, -l, w, -l + r);
    shape.lineTo(w, l - r); shape.quadraticCurveTo(w, l, w - r, l); shape.lineTo(-w + r, l);
    shape.quadraticCurveTo(-w, l, -w, l - r); shape.lineTo(-w, -l + r); shape.quadraticCurveTo(-w, -l, -w + r, -l);
    const eg = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3 });
    eg.rotateX(-Math.PI / 2);
    eg.translate(0, 0.22, 0);
    return eg;
  }), toonMaterial(color, { specular: 0.6, rim: 0.4 }));
  outlined(g, geo('carPlate', () => new THREE.BoxGeometry(1.1, 0.06, 1.5)), toonMaterial(0xffffff), { outline: false }).position.y = 0.66;
  const wheel = geo('wheel', () => { const c = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16); c.rotateZ(Math.PI / 2); return c; });
  const tire = toonMaterial(0x2b2b2b, { rim: 0.1 });
  for (const [x, z] of [[-0.72, 0.62], [0.72, 0.62], [-0.72, -0.62], [0.72, -0.62]]) outlined(g, wheel, tire).position.set(x, 0.22, z);
  g.userData.body = body;
  return g;
}

export function buildPeg(color: THREE.ColorRepresentation, small = false): THREE.Group {
  const g = new THREE.Group();
  outlined(g, geo('pegBody', () => new THREE.CapsuleGeometry(0.12, 0.22, 4, 10)), toonMaterial(color, { rim: 0.4 }), { thickness: 0.02 }).position.y = 0.2;
  outlined(g, geo('pegHead', () => new THREE.SphereGeometry(0.14, 12, 10)), toonMaterial(0xf5d0b0), { thickness: 0.02 }).position.y = 0.5;
  if (small) g.scale.setScalar(0.72);
  return g;
}
