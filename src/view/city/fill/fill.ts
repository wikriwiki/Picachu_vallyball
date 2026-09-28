/**
 * @pyramid-spec      design/view/city/fill/fill.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/fill/fill.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { BOARD, ERAS, LAYOUT } from '../../../data/data';
import { buildingMaterial, outlineMaterial, sdRoundBox, toonMaterial } from '../../toolkit/toolkit';
import { overlaps, type CityCtx, type Rect } from '../city-ctx';

export function blockCells(side: number): [number, number][] {
  return [[-side + 3.2, -17.8], [-12.2, -2.8], [2.8, 12.2], [17.8, side - 3.2]];
}

interface Inst { x: number; y: number; z: number; s?: number; h?: number; rot?: number; c?: number; roof?: number; a?: number; }

export function fillCity(ctx: CityCtx, roadDist: (x: number, z: number) => number): void {
  const { scene, rng, occupied, env, rows, zMin, zMax, side } = ctx;
  const { RS } = LAYOUT;
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
  const eraIdAt = (x: number, z: number) => ERAS[BOARD.tiles[env.nearestTile(x, z)[1]].era].id;
  const trunks: Inst[] = []; const leaves: Inst[] = []; const pines: Inst[] = []; const houses: Inst[] = [];
  const towers: Inst[] = []; const toys: Inst[] = []; const shops: Inst[] = [];
  const placed: { x: number; z: number }[] = [];
  const HOUSE_C = [0xfff5e6, 0xffe3e3, 0xe7f5ff, 0xfff9db, 0xe6fcf5];
  const ROOF_C = [0xe8590c, 0x1971c2, 0x2f9e44, 0xc2255c, 0xd6453d];
  const TOWER_C = [0xdee2e6, 0xa5d8ff, 0xffd8a8, 0xd0bfff, 0xc3fae8];
  const AWNING_C = [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8, 0xff922b];
  const TOY_C = [0xff8787, 0x74c0fc, 0xffe066, 0x8ce99a];

  for (let k = 0; k < rows; k++) {
    for (const sgn of [1, -1]) {
      const zc = k * RS + sgn * 5.2;
      if (zc < zMin + 2 || zc > zMax - 2) continue;
      for (const [xa, xb] of blockCells(side)) {
        for (let x = xa + 1.6; x <= xb - 1.4; x += 3.3) {
          const r: Rect = { x0: x - 1.5, x1: x + 1.5, z0: zc - 1.6, z1: zc + 1.6 };
          if (occupied.some((o) => overlaps(r, o))) continue;
          if (ctx.tileNear(r, 1.5)) continue;
          if (rng() < 0.12) continue;
          const eraId = eraIdAt(x, zc);
          const rot = sgn > 0 ? 0 : Math.PI;
          const y = 0.02;
          placed.push({ x, z: zc });
          const adult = eraId === 'adult1' || eraId === 'adult2';
          const roll = rng();
          if (eraId === 'baby' && roll < 0.35) toys.push({ x, y, z: zc, s: 0.9, rot, c: pick(TOY_C) });
          else if (adult && roll < 0.45) towers.push({ x, y, z: zc, s: 1.25, h: 4 + rng() * 6, rot, c: pick(TOWER_C) });
          else if (roll < (adult ? 0.75 : 0.35)) shops.push({ x, y, z: zc, rot, c: pick(HOUSE_C), a: pick(AWNING_C), h: 1.8 + rng() * 1.6 });
          else houses.push({ x, y, z: zc, s: 1.2, rot, c: pick(HOUSE_C), roof: pick(ROOF_C) });
        }
      }
    }
  }

  const { cx, cz, hx, hz, r: ir } = env.island;
  for (let k = 0; k < 2600; k++) {
    const x = cx + (rng() * 2 - 1) * hx;
    const z = cz + (rng() * 2 - 1) * hz;
    if (sdRoundBox(x - cx, z - cz, hx, hz, ir) > -5) continue;
    const [pd, ti] = env.nearestTile(x, z);
    if (pd < 3.4) continue;
    const rd = roadDist(x, z);
    if (rd < 3.0) continue;
    if (occupied.some((o) => x > o.x0 - 1.2 && x < o.x1 + 1.2 && z > o.z0 - 1.2 && z < o.z1 + 1.2)) continue;
    if (placed.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 3.4 * 3.4)) continue;
    placed.push({ x, z });
    const y = env.terrainHeight(x, z);
    const eraId = ERAS[BOARD.tiles[ti].era].id;
    const s = 0.7 + rng() * 0.5;
    const nearestRoadZ = ctx.roadZs.reduce((b, rz) => (Math.abs(z - rz) < Math.abs(z - b) ? rz : b), ctx.roadZs[0]);
    const facing = Math.abs(nearestRoadZ - z) === rd ? 0 : Math.PI / 2;
    if (rd < 5.2 && pd > 3.6 && rng() < 0.75) {
      if (eraId === 'baby') toys.push({ x, y, z, s, rot: facing, c: pick(TOY_C) });
      else if ((eraId === 'adult1' || eraId === 'adult2') && rng() < 0.45) towers.push({ x, y, z, s: s * 0.8, h: 3 + rng() * 4, rot: facing, c: pick(TOWER_C.slice(0, 4)) });
      else houses.push({ x, y, z, s, rot: facing, c: pick(HOUSE_C.slice(0, 4)), roof: pick(ROOF_C) });
    } else if (rng() < 0.6) {
      const blossom = (eraId === 'baby' || eraId === 'elem' || eraId === 'final') && rng() < 0.4;
      const autumn = !blossom && rng() < 0.35;
      trunks.push({ x, y, z, s });
      leaves.push({ x, y, z, s, c: blossom ? pick([0xf8a5c2, 0xf783ac, 0xfcc2d7]) : autumn ? pick([0xffd43b, 0xffa94d, 0xfcc419, 0xff922b]) : pick([0x69db7c, 0x8ce99a, 0x51cf66, 0xa9e34b]) });
    } else pines.push({ x, y, z, s, c: pick([0x2f9e44, 0x37b24d, 0x40c057]) });
  }

  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const col = new THREE.Color(); const m4 = new THREE.Matrix4();
  const olMat = outlineMaterial(0x2a2238, 0.04);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const inst = (geo: THREE.BufferGeometry, list: Inst[], mat: THREE.Material, place: (o: Inst) => [THREE.Vector3, number, THREE.Vector3, number | undefined]) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      const [p, rot, sc, c] = place(o);
      q.setFromAxisAngle(up, rot);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      if (c != null) im.setColorAt(i, col.set(c));
    });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    const ol = new THREE.InstancedMesh(geo, olMat, list.length);
    ol.instanceMatrix = im.instanceMatrix;
    scene.add(ol);
  };
  const trunkG = new THREE.CylinderGeometry(0.18, 0.26, 1.4, 7); trunkG.translate(0, 0.7, 0);
  const leafG = new THREE.IcosahedronGeometry(1.1, 1); leafG.translate(0, 2.1, 0);
  const pineG = new THREE.ConeGeometry(1.0, 3.2, 8); pineG.translate(0, 1.9, 0);
  const houseG = new THREE.BoxGeometry(2, 1.8, 2); houseG.translate(0, 0.9, 0);
  const roofG = new THREE.ConeGeometry(1.75, 1.3, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 2.45, 0);
  const towerG = new THREE.BoxGeometry(2.2, 1, 2.2); towerG.translate(0, 0.5, 0);
  const toyG = new THREE.BoxGeometry(1.3, 1.3, 1.3); toyG.translate(0, 0.65, 0);
  const shopG = new THREE.BoxGeometry(2.8, 1, 2.8); shopG.translate(0, 0.5, 0);
  const awnG = new THREE.BoxGeometry(2.9, 0.12, 0.9); awnG.translate(0, 0, 1.75);
  const roofSlabG = new THREE.BoxGeometry(3.0, 0.2, 3.0); roofSlabG.translate(0, 0.1, 0);
  const S = (o: Inst) => V(o.s ?? 1, o.s ?? 1, o.s ?? 1);
  inst(trunkG, trunks, toonMaterial(0x8d5a3b), (o) => [V(o.x, o.y, o.z), 0, S(o), undefined]);
  inst(leafG, leaves, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, S(o), o.c]);
  inst(pineG, pines, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, V(o.s!, o.s! * 1.1, o.s!), o.c]);
  inst(houseG, houses, buildingMaterial(0xffffff, { win: [1.0, 1.0], glass: 0x8fd3ff, floor0: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot!, S(o), o.c]);
  inst(roofG, houses, toonMaterial(0xffffff, { specular: 0.4 }), (o) => [V(o.x, o.y, o.z), o.rot!, S(o), o.roof]);
  inst(towerG, towers, buildingMaterial(0xffffff, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot!, V(o.s!, o.h!, o.s!), o.c]);
  inst(toyG, toys, toonMaterial(0xffffff, { specular: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot!, S(o), o.c]);
  inst(shopG, shops, buildingMaterial(0xffffff, { win: [1.1, 1.0], glass: 0x8fd3ff, floor0: 1.3 }), (o) => [V(o.x, o.y, o.z), o.rot!, V(1, o.h!, 1), o.c]);
  inst(awnG, shops, toonMaterial(0xffffff, { specular: 0.4 }), (o) => [V(o.x, o.y + 1.15, o.z), o.rot!, V(1, 1, 1), o.a]);
  inst(roofSlabG, shops, toonMaterial(0xffffff), (o) => [V(o.x, o.y + o.h!, o.z), o.rot!, V(1, 1, 1), o.a]);
}
