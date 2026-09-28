/**
 * @pyramid-spec      design/view/environment/environment.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/environment/environment.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { BOARD, ERAS, SUBMAPS, SUBMAP_IDS, createRng, type SubmapId, type Tile } from '../../data/data';
import { sdRoundBox, skyMaterial, textSprite, toonMaterial, waterMaterial } from '../toolkit/toolkit';
import type { Stage } from '../stage/stage';

export interface IslandRect { cx: number; cz: number; hx: number; hz: number; r: number; }
export interface SubIsland extends IslandRect { id: SubmapId; }
export interface Environment {
  readonly island: IslandRect;
  readonly subIslands: SubIsland[];
  terrainHeight(x: number, z: number): number;
  boardOut(x: number, z: number): number;
  nearestTile(x: number, z: number): [number, number];
}

const bounds = (ts: readonly { x: number; z: number }[]) => {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const t of ts) { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minZ = Math.min(minZ, t.z); maxZ = Math.max(maxZ, t.z); }
  return { minX, maxX, minZ, maxZ };
};

export function islandRectOf(tiles: readonly { x: number; z: number; era: number }[]): IslandRect {
  const b = bounds(tiles.filter((t) => t.era >= 0));
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, hx: (b.maxX - b.minX) / 2 + 26, hz: (b.maxZ - b.minZ) / 2 + 20, r: 22 };
}

export function subIslandsOf(tiles: readonly Tile[]): SubIsland[] {
  return SUBMAP_IDS.map((id) => {
    const b = bounds(tiles.filter((t) => t.era < 0 && t.sub === id));
    return { id, cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, hx: 16, hz: 14, r: 9 };
  });
}

export function buildEnvironment(stage: Stage): Environment {
  const { scene } = stage;
  const main = BOARD.tiles.filter((t) => t.era >= 0);
  const island = islandRectOf(BOARD.tiles);
  const sub = subIslandsOf(BOARD.tiles);
  const b = bounds(main);
  const bcx = (b.minX + b.maxX) / 2; const bcz = (b.minZ + b.maxZ) / 2;
  const bhx = (b.maxX - b.minX) / 2 + 12; const bhz = (b.maxZ - b.minZ) / 2 + 12;
  const boardOut = (x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x - bcx) - bhx), Math.max(0, Math.abs(z - bcz) - bhz));
  const nearestTile = (x: number, z: number): [number, number] => {
    let best = Infinity; let bi = main[0].i;
    for (const t of main) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < best) { best = d; bi = t.i; } }
    return [Math.sqrt(best), bi];
  };
  const rng = createRng(7);
  const tbl = Array.from({ length: 256 }, () => rng());
  const vnoise = (x: number, z: number) => {
    const xi = Math.floor(x); const zi = Math.floor(z);
    const xf = x - xi; const zf = z - zi;
    const h = (a: number, c: number) => tbl[(a * 57 + c * 131) & 255];
    const u = xf * xf * (3 - 2 * xf); const v = zf * zf * (3 - 2 * zf);
    return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
  };
  const hill = (x: number, z: number) => vnoise(x * 0.08, z * 0.08) * 0.7 + vnoise(x * 0.2, z * 0.2) * 0.3;
  const terrainHeight = (x: number, z: number) => {
    const d = sdRoundBox(x - island.cx, z - island.cz, island.hx, island.hz, island.r);
    if (d > 0) return -1;
    return Math.pow(hill(x, z), 2) * 7 * Math.min(1, boardOut(x, z) / 8) * Math.min(1, -d / 14);
  };

  // 해와 하늘
  const sunDir = new THREE.Vector3(0.45, 0.85, 0.35).normalize();
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const skyMat = skyMaterial();
  (skyMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // 본섬 지형
  const W = island.hx * 2 + 70; const H = island.hz * 2 + 70;
  const geo = new THREE.PlaneGeometry(W, H, Math.round(W / 1.1), Math.round(H / 1.1));
  geo.rotateX(-Math.PI / 2);
  geo.translate(island.cx, 0, island.cz);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xf4e2a8);
  const high = new THREE.Color(0x6e9e55);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const d = sdRoundBox(x - island.cx, z - island.cz, island.hx, island.hz, island.r);
    let y: number;
    if (d > 0) y = -0.5 - Math.min(d * 0.25, 6);
    else y = Math.min(1, -d / 6) * 0.02 + Math.pow(hill(x, z), 2) * 7 * Math.min(1, boardOut(x, z) / 8) * Math.min(1, -d / 14);
    pos.setY(i, y);
    c.set(ERAS[BOARD.tiles[nearestTile(x, z)[1]].era].ground);
    c.multiplyScalar(0.9 + vnoise(x * 0.3, z * 0.3) * 0.2);
    if (y > 2.5) c.lerp(high, Math.min(1, (y - 2.5) / 4));
    c.lerp(sand, 1 - Math.min(1, Math.max(0, (-d - 1) / 4)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, toonMaterial(0xffffff, { vertexColors: true, grass: 1, rim: 0.05, specular: 0 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // 서브맵 섬
  const grassCol: Record<SubmapId, number> = { countryside: 0x9fd46b, casino: 0x7fc98a, shrine: 0xa8d08d };
  for (const s of sub) {
    const g = new THREE.PlaneGeometry(s.hx * 2 + 24, s.hz * 2 + 24, 60, 56);
    g.rotateX(-Math.PI / 2);
    g.translate(s.cx, 0, s.cz);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const d = sdRoundBox(p.getX(i) - s.cx, p.getZ(i) - s.cz, s.hx, s.hz, s.r);
      p.setY(i, d > 0 ? -0.5 - Math.min(d * 0.3, 5) : 0.02);
      c.set(grassCol[s.id]).lerp(sand, 1 - Math.min(1, Math.max(0, (-d - 1) / 3)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, toonMaterial(0xffffff, { vertexColors: true, grass: 1, rim: 0.05, specular: 0 }));
    m.receiveShadow = true;
    scene.add(m);
    const label = textSprite(SUBMAPS[s.id].name, { bg: '#4dd4f0', color: '#fff', size: 56, scale: 1.2 });
    label.position.set(s.cx, 7, s.cz - s.hz + 2);
    scene.add(label);
  }

  // 바다
  const waterMat = waterMaterial();
  [island, ...sub].forEach((o, k) => {
    (waterMat.uniforms.uIsl.value as THREE.Vector4[])[k].set(o.cx, o.cz, o.hx, o.hz);
    (waterMat.uniforms.uIslR.value as number[])[k] = o.r;
  });
  (waterMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
  const wg = new THREE.PlaneGeometry(900, 900, 220, 220);
  wg.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, waterMat);
  water.position.set(island.cx, -1.1, island.cz);
  scene.add(water);

  stage.onFrame((time) => {
    sun.position.copy(stage.target).addScaledVector(sunDir, 70);
    sun.target.position.copy(stage.target);
    const sc = sun.shadow.camera;
    const ext = Math.max(30, stage.orbit.dist * 0.9);
    if (Math.abs(sc.right - ext) > 1) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    sky.position.copy(stage.camera.position);
    waterMat.uniforms.uTime.value = time;
    skyMat.uniforms.uTime.value = time;
  });

  return { island, subIslands: sub, terrainHeight, boardOut, nearestTile };
}
