/**
 * @pyramid-spec      design/view/city/streets/streets.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/streets/streets.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { LAYOUT } from '../../../data/data';
import { outlined, roadMaterial, toonMaterial } from '../../toolkit/toolkit';
import type { CityCtx } from '../city-ctx';

export const ROAD_W = 4.8;
export const ALLEYS = [-15, 0, 15];

export function makeRoadDist(roadZs: readonly number[], side: number, zMin: number, zMax: number): (x: number, z: number) => number {
  return (x, z) => {
    let best = Infinity;
    if (Math.abs(x) <= side + ROAD_W) for (const rz of roadZs) best = Math.min(best, Math.abs(z - rz));
    if (z >= zMin - ROAD_W && z <= zMax + ROAD_W) {
      best = Math.min(best, Math.abs(Math.abs(x) - side));
      for (const ax of ALLEYS) best = Math.min(best, Math.abs(x - ax));
    }
    return best;
  };
}

export function lampSpots(roadZs: readonly number[], side: number, row: number): [number, number][] {
  const out: [number, number][] = [];
  for (const z of roadZs) {
    for (let x = -side + 6; x <= side - 6; x += 12) {
      if (Math.abs(Math.abs(x) - row / 2) < 3 || ALLEYS.some((ax) => Math.abs(x - ax) < 3)) continue;
      out.push([x, z + (out.length % 2 ? 1 : -1) * (ROAD_W / 2 - 0.3)]);
    }
  }
  return out;
}

export function buildStreets(ctx: CityCtx): (x: number, z: number) => number {
  const { scene, roadZs, side, zMin, zMax, rows, rng } = ctx;
  const { ROW, RS } = LAYOUT;
  const rmat = roadMaterial();
  const addRoad = (cx: number, cz: number, len: number, horizontal: boolean) => {
    const g = new THREE.PlaneGeometry(len, ROAD_W, Math.ceil(len / 2), 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len);
    g.rotateX(-Math.PI / 2);
    if (!horizontal) g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, rmat);
    m.position.set(cx, horizontal ? 0.06 : 0.055, cz);
    m.receiveShadow = true;
    scene.add(m);
  };
  for (const z of roadZs) addRoad(0, z, side * 2 + ROAD_W, true);
  for (const ax of ALLEYS) addRoad(ax, (zMax + zMin) / 2, zMax - zMin, false);
  for (const sx of [-side, side]) addRoad(sx, (zMax + zMin) / 2, zMax - zMin + ROAD_W, false);

  const m4 = new THREE.Matrix4();
  const cross: [number, number, number][] = [];
  for (let k = 0; k < rows - 1; k++) {
    const cx = k % 2 === 0 ? ROW / 2 : -ROW / 2;
    for (let i = -3; i <= 3; i++) cross.push([cx + i * 0.8, 0.075, k * RS + RS / 2]);
  }
  const cim = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.02, 3.1), toonMaterial(0xffffff, { rim: 0 }), cross.length);
  cross.forEach((p, i) => { m4.makeTranslation(...p); cim.setMatrixAt(i, m4); });
  cim.receiveShadow = true;
  scene.add(cim);

  const lamps = lampSpots(roadZs, side, ROW);
  const poleG = new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6); poleG.translate(0, 1.3, 0);
  const headG = new THREE.SphereGeometry(0.22, 10, 8); headG.translate(0, 2.7, 0);
  const pole = new THREE.InstancedMesh(poleG, toonMaterial(0x495057), lamps.length);
  const head = new THREE.InstancedMesh(headG, toonMaterial(0xfff3bf, { emissive: 0x6b5a1a, rim: 0.2 }), lamps.length);
  lamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0.05, z); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
  pole.castShadow = true;
  scene.add(pole, head);

  const carColors = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x51cf66, 0xffffff, 0xcc5de8, 0xff922b];
  const bodyG = new THREE.BoxGeometry(1.5, 0.5, 0.8);
  const cabG = new THREE.BoxGeometry(0.8, 0.4, 0.7);
  const wheelG = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10); wheelG.rotateX(Math.PI / 2);
  const tireM = toonMaterial(0x2b2b2b);
  const glassM = toonMaterial(0x9fd4ff, { specular: 0.9 });
  const cars: { g: THREE.Group; body: THREE.Mesh; dir: number; speed: number; x: number; z: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const body = outlined(g, bodyG, toonMaterial(carColors[i % carColors.length], { specular: 0.7, rim: 0.4 }));
    body.position.y = 0.42;
    outlined(g, cabG, glassM).position.set(-0.1, 0.87, 0);
    for (const [x, z] of [[-0.5, 0.38], [0.5, 0.38], [-0.5, -0.38], [0.5, -0.38]]) { const w = new THREE.Mesh(wheelG, tireM); w.position.set(x, 0.17, z); g.add(w); }
    const dir = i % 2 ? 1 : -1;
    const rz = roadZs[Math.floor(rng() * roadZs.length)];
    const speed = 3.5 + rng() * 3;
    const x = -side + rng() * side * 2;
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(g);
    cars.push({ g, body, dir, speed, x, z: rz + dir * 0.75 });
  }
  ctx.updaters.push((t, dt) => {
    for (const c of cars) {
      c.x += c.dir * c.speed * dt;
      if (c.x > side) c.x = -side;
      if (c.x < -side) c.x = side;
      const nearCross = Math.abs(Math.abs(c.x) - ROW / 2) < 3;
      c.g.position.set(c.x, 0.06, c.z);
      c.body.position.y = 0.42 + Math.sin(t * 12 + c.x) * (nearCross ? 0 : 0.015);
    }
  });
  return makeRoadDist(roadZs, side, zMin, zMax);
}
