/**
 * @pyramid-spec      design/view/board-view/board-mesh/board-mesh.md
 * @pyramid-parent    design/view/board-view/board-view.md
 * @pyramid-on-change 1) design/view/board-view/board-mesh/board-mesh.md 먼저 수정 2) 이 코드 수정 3) design/view/board-view/board-view.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { BOARD, ERAS, TILE_INFO, type RouteId, type Tile } from '../../../data/data';
import { outlined, textSprite, tileMaterial, toonMaterial } from '../../toolkit/toolkit';
import type { Stage } from '../../stage/stage';
import type { makeIconAtlas } from '../atlas/atlas';

export interface BoardView { readonly tilePos: THREE.Vector3[]; readonly tileHeading: number[]; setActiveTile(i: number): void; }

export const TILE_Y = 0.32;
export const ROUTE_COLOR: Readonly<Record<RouteId | 'sub', number>> = { main: 0xffe27a, love: 0xff9ec8, career: 0xffb05c, study: 0x9cc9ff, sub: 0xfff1c9 };

export function tileHeadings(tiles: readonly Tile[]): number[] {
  const prevOf = new Map<number, Tile>();
  for (const t of tiles) for (const k of t.next) if (!prevOf.has(k)) prevOf.set(k, t);
  const byI = new Map(tiles.map((t) => [t.i, t]));
  return tiles.map((t) => {
    if (t.next.length) { const o = byI.get(t.next[0])!; return Math.atan2(o.x - t.x, o.z - t.z); }
    const p = prevOf.get(t.i);
    return p ? Math.atan2(t.x - p.x, t.z - p.z) : 0;
  });
}
export function tileColor(t: Tile): number {
  if (t.type === 'end' || t.type === 'goal') return 0xffffff;
  if (t.type === 'start' && t.era >= 0) return ERAS[t.era].color;
  return TILE_INFO[t.type].color;
}
export function tileGlow(t: Tile): 0 | 1 | 2 {
  return t.type === 'star3' ? 1 : t.type === 'destiny' ? 2 : 0;
}

export function buildBoardMesh(stage: Stage, atlas: ReturnType<typeof makeIconAtlas>): BoardView {
  const { scene } = stage;
  const tiles = BOARD.tiles;
  const n = tiles.length;
  const tilePos = tiles.map((t) => new THREE.Vector3(t.x, TILE_Y, t.z));
  const tileHeading = tileHeadings(tiles);

  // 길 띠
  const pads: { x: number; z: number; w: number; d: number; c: number }[] = [];
  for (const t of tiles) {
    pads.push({ x: t.x, z: t.z, w: 3.5, d: 3.5, c: ROUTE_COLOR[t.route] });
    for (const k of t.next) {
      const u = tiles[k];
      const route = t.route === 'main' ? u.route : t.route;
      pads.push({ x: (t.x + u.x) / 2, z: (t.z + u.z) / 2, w: Math.abs(u.x - t.x) + 1.6, d: Math.abs(u.z - t.z) + 1.6, c: ROUTE_COLOR[route] });
    }
  }
  const padG = new THREE.BoxGeometry(1, 0.16, 1);
  padG.translate(0, 0.08, 0);
  const padMesh = new THREE.InstancedMesh(padG, toonMaterial(0xffffff, { rim: 0.05, specular: 0 }), pads.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  pads.forEach((o, k) => { m4.makeScale(o.w, 1, o.d).setPosition(o.x, 0, o.z); padMesh.setMatrixAt(k, m4); padMesh.setColorAt(k, col.set(o.c)); });
  padMesh.receiveShadow = true;
  scene.add(padMesh);

  // 칸
  const shape = new THREE.Shape();
  const h = 1.3; const r = 0.38;
  shape.moveTo(-h + r, -h); shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r); shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h); shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const tg = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 6 });
  tg.rotateX(-Math.PI / 2);
  const tileMat = tileMaterial(atlas.texture, atlas.grid);
  tileMat.uniforms.uTopY.value = 0.46;
  const aIcon = new Float32Array(n); const aIndex = new Float32Array(n); const aColor = new Float32Array(n * 3); const aGlow = new Float32Array(n);
  tiles.forEach((t, i) => {
    aIcon[i] = atlas.index(t.type); aIndex[i] = i; aGlow[i] = tileGlow(t);
    col.set(tileColor(t)); aColor.set([col.r, col.g, col.b], i * 3);
  });
  tg.setAttribute('aIcon', new THREE.InstancedBufferAttribute(aIcon, 1));
  tg.setAttribute('aIndex', new THREE.InstancedBufferAttribute(aIndex, 1));
  tg.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
  tg.setAttribute('aGlow', new THREE.InstancedBufferAttribute(aGlow, 1));
  const tileMesh = new THREE.InstancedMesh(tg, tileMat, n);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    q.setFromAxisAngle(up, tileHeading[i]);
    const big = tiles[i].type === 'stop' || tiles[i].type === 'goal' ? 1.2 : 1;
    m4.compose(new THREE.Vector3(tilePos[i].x, 0.02, tilePos[i].z), q, new THREE.Vector3(big, big, big));
    tileMesh.setMatrixAt(i, m4);
  }
  tileMesh.receiveShadow = true;
  tileMesh.frustumCulled = false;
  scene.add(tileMesh);

  // 시대 아치
  const beamM = toonMaterial(0xffffff);
  const pillarG = new THREE.CylinderGeometry(0.22, 0.26, 4.2, 12);
  ERAS.forEach((era, ei) => {
    const i0 = BOARD.eraStart[ei];
    const arch = new THREE.Group();
    const colM = toonMaterial(era.color);
    for (const sx of [-1, 1]) outlined(arch, pillarG, colM).position.set(sx * 2.4, 2.1, 0);
    outlined(arch, new THREE.BoxGeometry(5.6, 0.7, 0.5), beamM).position.y = 4.3;
    const label = textSprite(era.name, { bg: '#' + new THREE.Color(era.color).getHexString(), color: '#2a2238', size: 56, scale: 0.9 });
    label.position.set(0, 5.6, 0);
    arch.add(label);
    arch.position.set(tilePos[i0].x, 0, tilePos[i0].z);
    arch.rotation.y = tileHeading[i0];
    scene.add(arch);
  });
  // STOP 이름표
  tiles.forEach((t, i) => {
    if (t.type !== 'stop') return;
    const sp = textSprite(t.stop === 'marriage' ? '💒 결혼 STOP' : '🏠 내 집 마련 STOP', { bg: '#e03131', size: 44, scale: 0.9 });
    sp.position.copy(tilePos[i]).add(new THREE.Vector3(0, 3.2, 0));
    scene.add(sp);
  });
  // GOAL 아치
  const gi = BOARD.eraEnd[BOARD.eraEnd.length - 1];
  const goal = new THREE.Group();
  const gold = toonMaterial(0xffd43b, { specular: 0.8, rim: 0.6 });
  for (const sx of [-1, 1]) outlined(goal, new THREE.CylinderGeometry(0.35, 0.4, 6, 14), gold).position.set(sx * 3, 3, 0);
  outlined(goal, new THREE.TorusGeometry(3, 0.35, 10, 32, Math.PI), gold).position.y = 6;
  const gl = textSprite('GOAL!', { bg: '#ffd43b', color: '#8a4b00', size: 72, scale: 1.8 });
  gl.position.set(0, 10, 0);
  goal.add(gl);
  goal.position.set(tilePos[gi].x, 0, tilePos[gi].z);
  goal.rotation.y = tileHeading[gi];
  scene.add(goal);

  // 분기 화살표
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.9); arrowShape.lineTo(0.8, 0); arrowShape.lineTo(0.3, 0); arrowShape.lineTo(0.3, -0.8);
  arrowShape.lineTo(-0.3, -0.8); arrowShape.lineTo(-0.3, 0); arrowShape.lineTo(-0.8, 0); arrowShape.closePath();
  const ag = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  ag.rotateX(-Math.PI / 2);
  const am = toonMaterial(0x3b9bff, { specular: 0.8, rim: 0.6, emissive: 0x0a2a55 });
  const arrows: THREE.Group[] = [];
  for (const br of BOARD.branches) {
    const j = tiles[br.junction];
    for (const k of j.next) {
      const t = tiles[k];
      const a = new THREE.Group();
      outlined(a, ag, am).rotation.y = Math.atan2(t.x - j.x, t.z - j.z) + Math.PI;
      a.position.set((j.x + t.x) / 2, 1.2, (j.z + t.z) / 2);
      a.scale.setScalar(1.1);
      scene.add(a);
      arrows.push(a);
    }
  }
  stage.onFrame((time) => { for (const a of arrows) a.position.y = 1.3 + Math.sin(time * 4) * 0.25; });

  return { tilePos, tileHeading, setActiveTile: (i) => { tileMat.uniforms.uActive.value = i; } };
}
