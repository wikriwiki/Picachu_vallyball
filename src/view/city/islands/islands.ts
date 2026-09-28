/**
 * @pyramid-spec      design/view/city/islands/islands.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/islands/islands.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { box, buildingMaterial, cyl, gable, outlined, toonMaterial } from '../../toolkit/toolkit';
import { sign } from '../landmarks/landmarks';
import type { CityCtx } from '../city-ctx';

export function ringTreeSpots(hx: number, hz: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const x = Math.cos(a) * (hx - 2.5);
    const z = Math.sin(a) * (hz - 2.5);
    if (z > 6 && Math.abs(x) < 8) continue;
    out.push([x, z]);
  }
  return out;
}

export function decorateIslands(ctx: CityCtx): void {
  const white = toonMaterial(0xffffff);
  const wood = toonMaterial(0x9c6b43);
  const gold = toonMaterial(0xffd43b, { specular: 0.9, rim: 0.6 });
  const stone = buildingMaterial(0xd8d2c4, { brick: true });
  for (const isl of ctx.env.subIslands) {
    const g = new THREE.Group();
    g.position.set(isl.cx, 0.02, isl.cz);
    ctx.scene.add(g);
    const back = -4.5;
    if (isl.id === 'countryside') {
      box(g, 4, 2.6, 3, toonMaterial(0xc92a2a), -8, 0, back + 14);
      gable(g, 4.6, 1.6, 3.4, toonMaterial(0xf8f9fa), -8, 2.6, back + 14).rotation.y = Math.PI / 2;
      cyl(g, 0.5, 0.7, 5, white, 9, 0, back + 14, 10);
      const blades = new THREE.Group(); blades.position.set(9, 5, back + 13.2); g.add(blades);
      for (let k = 0; k < 4; k++) {
        const bg = new THREE.BoxGeometry(0.35, 2.6, 0.08); bg.translate(0, 1.3, 0);
        outlined(blades, bg, wood).rotation.z = (k * Math.PI) / 2;
      }
      ctx.updaters.push((t) => { blades.rotation.z = t * 1.2; });
      for (let k = 0; k < 5; k++) box(g, 1.4, 0.3, 3.4, toonMaterial(k % 2 ? 0x8d5a3b : 0x74b816), -3 + k * 1.6, 0, back + 14, { outline: false });
    } else if (isl.id === 'casino') {
      box(g, 12, 4.5, 3.6, buildingMaterial(0x2b2d42, { win: [1.2, 1.2], glass: 0xffd43b }), 0, 0, back + 15);
      box(g, 12.4, 0.5, 4, gold, 0, 4.5, back + 15);
      sign(g, '★ CASINO ★', { w: 7, h: 1.2, bg: '#c2255c', fg: '#ffe066', y: 3.2, z: back + 13.1 }).rotation.y = Math.PI;
      for (const x of [-10, 10]) {
        cyl(g, 0.2, 0.3, 4, wood, x, 0, back + 13, 6);
        for (let k = 0; k < 5; k++) { const l = box(g, 2.2, 0.1, 0.6, toonMaterial(0x2f9e44), x, 4, back + 13); l.rotation.y = (k / 5) * Math.PI * 2; l.rotation.z = -0.4; }
      }
    } else {
      const red = toonMaterial(0xe03131, { specular: 0.3 });
      box(g, 0.5, 5, 0.5, red, -10.4, 0, -2); box(g, 0.5, 5, 0.5, red, -10.4, 0, 2);
      box(g, 0.7, 0.5, 7.4, red, -10.4, 4.9, 0); box(g, 0.5, 0.35, 6.2, red, -10.4, 4.0, 0);
      box(g, 8, 3, 3.6, wood, 0, 0, back + 15);
      gable(g, 5.2, 2.2, 9.4, toonMaterial(0x343a40), 0, 3, back + 15).rotation.y = Math.PI / 2;
      for (const x of [-5, 5]) {
        box(g, 0.8, 0.6, 0.8, stone, x, 0, back + 12.2);
        box(g, 0.5, 0.9, 0.5, toonMaterial(0xfff3bf, { emissive: 0x554400 }), x, 0.6, back + 12.2);
        box(g, 1, 0.3, 1, stone, x, 1.5, back + 12.2);
      }
    }
    const leafCol = isl.id === 'shrine' ? 0xf8a5c2 : isl.id === 'casino' ? 0x40c057 : 0x8ce99a;
    for (const [x, z] of ringTreeSpots(isl.hx, isl.hz)) {
      cyl(g, 0.15, 0.22, 1.2, toonMaterial(0x8d5a3b), x, 0, z, 6);
      outlined(g, new THREE.IcosahedronGeometry(1, 1), toonMaterial(leafCol, { rim: 0.4 })).position.set(x, 1.9, z);
    }
  }
}
