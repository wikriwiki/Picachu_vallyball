/**
 * @pyramid-spec      design/view/city/landmarks/landmarks.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/landmarks/landmarks.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { BOARD, ERAS, LAYOUT, type EraId } from '../../../data/data';
import { box, buildingMaterial, canvasTexture, cone, cyl, gable, outlined, toonMaterial } from '../../toolkit/toolkit';
import { overlaps, type CityCtx, type Rect } from '../city-ctx';
import { ROAD_W } from '../streets/streets';

export type LandmarkType = 'hospital' | 'playground' | 'schoolElem' | 'field' | 'schoolMiddle' | 'gym' | 'schoolHigh' | 'library'
  | 'offices' | 'apartments' | 'chapel' | 'mall' | 'mansion' | 'park' | 'onsen' | 'castle';

export const DISTRICTS: Readonly<Record<EraId, { at30: LandmarkType; at70: LandmarkType; stop?: LandmarkType }>> = {
  baby: { at30: 'hospital', at70: 'playground' },
  elem: { at30: 'schoolElem', at70: 'field' },
  middle: { at30: 'schoolMiddle', at70: 'gym' },
  high: { at30: 'schoolHigh', at70: 'library' },
  adult1: { at30: 'offices', at70: 'apartments', stop: 'chapel' },
  adult2: { at30: 'mall', at70: 'offices', stop: 'mansion' },
  final: { at30: 'park', at70: 'onsen' },
};
export const BLOCK_OFF = 4.75;
export const BLOCK_DEPTH = 6;

type Mats = Record<string, THREE.Material>;
let MAT: Mats | null = null;
function mats(): Mats {
  if (MAT) return MAT;
  MAT = {
    white: toonMaterial(0xffffff), red: toonMaterial(0xe03131, { specular: 0.4 }),
    roofRed: toonMaterial(0xd6453d, { specular: 0.35 }), roofBlue: toonMaterial(0x4c6ef5, { specular: 0.35 }), roofGreen: toonMaterial(0x2f9e44, { specular: 0.3 }),
    dark: toonMaterial(0x495057), wood: toonMaterial(0x9c6b43), gold: toonMaterial(0xffd43b, { specular: 0.9, rim: 0.6 }),
    hedge: toonMaterial(0x3aa04d, { rim: 0.3 }), grass: toonMaterial(0x7cc56a, { grass: 1, rim: 0 }), sand: toonMaterial(0xf1dca0, { rim: 0 }),
    pave: toonMaterial(0xe9e2d0, { rim: 0 }), water: toonMaterial(0x4fc3f7, { specular: 0.9, rim: 0.5, emissive: 0x0b3a55 }),
    stone: buildingMaterial(0xd8d2c4, { brick: true }),
    hospital: buildingMaterial(0xffffff, { win: [1.3, 1.2], glass: 0x74c0fc }),
    brick: buildingMaterial(0xb5563b, { win: [1.25, 1.25], brick: true, glass: 0x8fd3ff }),
    schoolCream: buildingMaterial(0xf3e3c3, { win: [1.25, 1.25], glass: 0x8fd3ff }),
    schoolGray: buildingMaterial(0xd9dde3, { win: [1.25, 1.25], glass: 0x8fd3ff }),
    office1: buildingMaterial(0xdfe7ef, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 }),
    office2: buildingMaterial(0xa5d8ff, { win: [0.9, 1.0], glass: 0x2f6fb0, specular: 0.5 }),
    office3: buildingMaterial(0xffe8cc, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 }),
    apt: buildingMaterial(0xfff0e6, { win: [1.1, 1.2], glass: 0x74c0fc }), aptPink: buildingMaterial(0xffdeeb, { win: [1.1, 1.2], glass: 0x74c0fc }),
    mall: buildingMaterial(0xfdfdfd, { win: [2.0, 1.4], glass: 0x66d9e8, floor0: 0.3 }),
    mansion: buildingMaterial(0xfffaf0, { win: [1.4, 1.3], glass: 0x8fd3ff }),
    library: buildingMaterial(0xf1e0c5, { win: [1.4, 1.3], glass: 0x8fd3ff }),
    gym: buildingMaterial(0xe7f5ff, { win: [1.6, 1.2], glass: 0x74c0fc }),
    onsen: buildingMaterial(0xc99a6b, { win: [1.5, 1.2], glass: 0xffe8a3 }),
  };
  return MAT;
}

export function sign(parent: THREE.Object3D, text: string, o: { w?: number; h?: number; bg?: string; fg?: string; x?: number; y?: number; z?: number } = {}): THREE.Mesh {
  const { w = 3, h = 0.8, bg = '#ffffff', fg = '#2a2238', x = 0, y = 3, z = 0 } = o;
  const tex = canvasTexture(512, Math.round((512 * h) / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.fillStyle = fg; g.font = `bold ${Math.round(ch * 0.62)}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function clockFace(parent: THREE.Object3D, r: number, x: number, y: number, z: number) {
  const tex = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    g.lineWidth = 12; g.strokeStyle = '#3b2f2f'; g.stroke();
    g.fillStyle = '#3b2f2f';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 92 - 5, 128 + Math.sin(a) * 92 - 5, 10, 10); }
    g.lineCap = 'round'; g.lineWidth = 10; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(180, 150); g.stroke();
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  parent.add(m);
}
function schoolBuilding(g: THREE.Group, wall: THREE.Material, roof: THREE.Material) {
  const M = mats();
  box(g, 10, 3.6, 4.2, wall, 0, 0, -0.6);
  box(g, 10.4, 0.25, 4.6, M.white, 0, 3.6, -0.6);
  box(g, 2.6, 6.6, 2.6, wall, 0, 0, 0.4);
  cone(g, 2.3, 1.8, roof, 0, 6.6, 0.4, 4).rotation.y = Math.PI / 4;
  clockFace(g, 0.8, 0, 5.4, 1.72);
  box(g, 1.6, 1.6, 0.3, M.white, 0, 0, 1.8);
  box(g, 11, 0.4, 0.3, M.hedge, 0, 0, 2.6);
}

export const BUILDERS: Readonly<Record<LandmarkType, (g: THREE.Group) => void>> = {
  hospital(g) {
    const M = mats();
    box(g, 9, 4.6, 4.6, M.hospital, 0, 0, -0.4);
    box(g, 9.3, 0.3, 4.9, M.white, 0, 4.6, -0.4);
    box(g, 3, 0.25, 1.6, toonMaterial(0x74c0fc), 0, 2.1, 2.3);
    for (const x of [-1.3, 1.3]) cyl(g, 0.1, 0.1, 2.1, M.white, x, 0, 2.9, 8);
    box(g, 0.5, 1.6, 0.2, M.red, 0, 3.5, 1.95);
    box(g, 1.6, 0.5, 0.2, M.red, 0, 4.05, 1.95);
    sign(g, '산부인과', { w: 2.6, h: 0.6, bg: '#e03131', fg: '#fff', x: 2.7, y: 3.4, z: 1.92 });
  },
  playground(g) {
    const M = mats();
    box(g, 10.5, 0.08, 5.5, M.sand, 0, 0, 0, { outline: false });
    box(g, 1.3, 1.9, 1.3, toonMaterial(0xffd43b), -3.3, 0, -0.8);
    box(g, 1.1, 0.12, 3.2, toonMaterial(0xff6b6b, { specular: 0.6 }), -3.3, 0.9, 1.2).rotation.x = 0.55;
    const blue = toonMaterial(0x4dabf7);
    for (const x of [0.6, 3.8]) for (const dz of [-0.6, 0.6]) cyl(g, 0.08, 0.08, 2.6, blue, x, 0, dz, 6).rotation.x = dz > 0 ? -0.2 : 0.2;
    const bar = cyl(g, 0.08, 0.08, 3.4, blue, 2.2, 2.45, 0, 6); bar.rotation.z = Math.PI / 2; bar.position.y = 2.5;
    for (const x of [1.5, 2.9]) { box(g, 0.6, 0.08, 0.35, M.red, x, 0.6, 0); for (const dx of [-0.25, 0.25]) cyl(g, 0.02, 0.02, 1.85, M.dark, x + dx, 0.65, 0, 4, { outline: false }); }
    box(g, 3, 0.15, 0.4, toonMaterial(0x51cf66), 2.2, 0.35, 2.1).rotation.z = 0.15;
    box(g, 0.3, 0.4, 0.3, M.dark, 2.2, 0, 2.1);
  },
  schoolElem(g) { const M = mats(); schoolBuilding(g, M.brick, M.roofGreen); },
  schoolMiddle(g) { const M = mats(); schoolBuilding(g, M.schoolCream, M.roofBlue); },
  schoolHigh(g) { const M = mats(); schoolBuilding(g, M.schoolGray, M.roofRed); },
  field(g) {
    const tex = canvasTexture(512, 256, (c, w, h) => {
      c.fillStyle = '#5fbf5a'; c.fillRect(0, 0, w, h);
      const track = (pad: number) => { c.beginPath(); c.moveTo(128, pad); c.lineTo(384, pad); c.arc(384, 128, 128 - pad, -Math.PI / 2, Math.PI / 2); c.lineTo(128, 256 - pad); c.arc(128, 128, 128 - pad, Math.PI / 2, Math.PI * 1.5); c.stroke(); };
      c.strokeStyle = '#d9534f'; c.lineWidth = 46; track(30);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; track(16); track(30); track(44);
      c.lineWidth = 3; c.strokeRect(200, 96, 112, 64);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.6), new THREE.MeshToonMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.receiveShadow = true;
    g.add(m);
    const M = mats();
    for (const x of [-4.8, 4.8]) { cyl(g, 0.06, 0.06, 1.8, M.white, x, 0, 0, 6); box(g, 0.1, 0.7, 1.6, M.white, x, 1.1, 0, { outline: false }); }
  },
  gym(g) {
    const M = mats();
    box(g, 9, 2.8, 4.8, M.gym, 0, 0, -0.3);
    const roof = outlined(g, new THREE.CylinderGeometry(2.6, 2.6, 9.2, 24, 1, false, 0, Math.PI), toonMaterial(0x15aabf, { specular: 0.6 }));
    roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    roof.position.set(0, 2.8, -0.3); roof.scale.set(1, 1, 0.55);
    sign(g, 'GYM', { w: 2, h: 0.6, bg: '#15aabf', fg: '#fff', y: 2.2, z: 2.12 });
  },
  library(g) {
    const M = mats();
    box(g, 9, 3.4, 4, M.library, 0, 0, -0.8);
    box(g, 6, 0.3, 1.6, M.white, 0, 0, 1.9, { outline: false });
    for (let i = 0; i < 5; i++) cyl(g, 0.2, 0.22, 2.8, M.white, -2.4 + i * 1.2, 0.3, 1.9, 10);
    box(g, 6.4, 0.3, 1.9, M.white, 0, 3.1, 1.75);
    gable(g, 6.6, 1.2, 1.9, M.white, 0, 3.4, 1.75);
    box(g, 9.4, 0.3, 4.4, toonMaterial(0x6c757d), 0, 3.4, -0.8);
    sign(g, '도서관', { w: 2.2, h: 0.5, bg: '#fff', x: 0, y: 3.95, z: 2.72 });
  },
  offices(g) {
    const M = mats();
    for (const [x, h, mat] of [[-3.6, 9, M.office1], [0.2, 12.5, M.office2], [3.8, 7, M.office3]] as [number, number, THREE.Material][]) {
      box(g, 3.2, h, 3.6, mat, x, 0, -0.6);
      box(g, 3.4, 0.25, 3.8, M.white, x, h, -0.6);
      box(g, 1, 0.7, 1, M.dark, x + 0.6, h + 0.25, -0.8);
    }
  },
  apartments(g) {
    const M = mats();
    for (const [x, mat, h] of [[-2.9, M.apt, 7.2], [2.9, M.aptPink, 6]] as [number, THREE.Material, number][]) {
      box(g, 5, h, 3.4, mat, x, 0, -0.8);
      box(g, 5.2, 0.25, 3.6, M.white, x, h, -0.8);
      for (let y = 1.2; y < h - 0.5; y += 1.2) box(g, 5, 0.12, 0.5, M.white, x, y, 1.1, { outline: false });
    }
  },
  chapel(g) {
    const M = mats();
    const purple = toonMaterial(0x91a7ff, { specular: 0.4 });
    box(g, 6, 3.4, 4.4, M.white, 1, 0, -0.5);
    gable(g, 6.6, 2.4, 4.8, purple, 1, 3.4, -0.5).rotation.y = Math.PI / 2;
    box(g, 1.8, 6.2, 1.8, M.white, -3.4, 0, 0.4);
    cone(g, 1.4, 2.2, purple, -3.4, 6.2, 0.4, 4).rotation.y = Math.PI / 4;
    const bell = outlined(g, new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold);
    bell.position.set(-3.4, 4.8, 1.32); bell.rotation.x = Math.PI;
    cone(g, 0.12, 0.5, M.gold, -3.4, 8.4, 0.4, 6);
    box(g, 1.6, 2.2, 0.2, toonMaterial(0xffc9de), 1, 0, 1.8);
    sign(g, '♥ WEDDING', { w: 3, h: 0.6, bg: '#ff8fab', fg: '#fff', x: 1, y: 2.75, z: 1.72 });
  },
  mall(g) {
    const M = mats();
    box(g, 11, 3.4, 5.2, M.mall, 0, 0, -0.2);
    box(g, 11.4, 0.3, 5.6, toonMaterial(0xff922b), 0, 3.4, -0.2);
    [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8].forEach((c, i) => { box(g, 2.1, 0.12, 1, toonMaterial(c), -4.4 + i * 2.2, 2.2, 2.8).rotation.x = 0.35; });
    sign(g, 'SHOPPING MALL', { w: 5, h: 0.7, bg: '#ff922b', fg: '#fff', y: 3.0, z: 2.42 });
  },
  mansion(g) {
    const M = mats();
    box(g, 11.4, 0.06, 5.8, M.grass, 0, 0, 0, { outline: false });
    box(g, 7.4, 3.4, 4, M.mansion, 0, 0, -0.6);
    gable(g, 4.8, 2, 8, M.roofRed, 0, 3.4, -0.6).rotation.y = Math.PI / 2;
    for (const x of [-2, 2]) { box(g, 1.2, 1, 1, M.mansion, x, 3.6, 1.3); gable(g, 1.4, 0.8, 1.2, M.roofRed, x, 4.6, 1.3); }
    box(g, 1.4, 2.2, 0.2, M.wood, 0, 0, 1.45);
    for (const s of [-1, 1]) box(g, 0.5, 0.8, 5.4, M.hedge, s * 5.4, 0, 0);
    box(g, 10.3, 0.8, 0.5, M.hedge, 0, 0, -2.7);
    for (const x of [-4, 4]) box(g, 3, 0.8, 0.5, M.hedge, x, 0, 2.7);
  },
  park(g) {
    const M = mats();
    box(g, 11.4, 0.06, 5.8, M.grass, 0, 0, 0, { outline: false });
    outlined(g, new THREE.CylinderGeometry(2.6, 2.6, 0.08, 32), M.pave, { outline: false }).position.y = 0.07;
    cyl(g, 1.6, 1.7, 0.5, M.stone, 0, 0.08, 0, 24);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.1, 24), M.water);
    w.position.y = 0.52; g.add(w);
    cyl(g, 0.25, 0.35, 1.2, M.stone, 0, 0.5, 0, 12);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xd0f4ff, transparent: true, opacity: 0.55, depthWrite: false }));
    jet.position.y = 2.4; jet.rotation.x = Math.PI; g.add(jet);
    g.userData.jet = jet;
    for (const [x, z] of [[-4, -1.5], [4, -1.5], [-4, 1.6], [4, 1.6]]) { box(g, 1.6, 0.35, 0.5, M.wood, x, 0.3, z); box(g, 1.6, 0.5, 0.12, M.wood, x, 0.65, z - 0.2); }
    const flowers = [0xff8fab, 0xffd43b, 0xcc5de8, 0xff6b6b, 0xffffff];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toonMaterial(flowers[i % flowers.length]));
      f.position.set(Math.cos(a) * 3.1, 0.2, Math.sin(a) * 2.4); g.add(f);
    }
  },
  onsen(g) {
    const M = mats();
    box(g, 8.4, 2.6, 4.2, M.onsen, 0, 0, -0.5);
    gable(g, 5.6, 1.6, 9.6, toonMaterial(0x495057, { specular: 0.3 }), 0, 2.6, -0.5).rotation.y = Math.PI / 2;
    box(g, 2, 0.1, 1.2, M.wood, 0, 2.2, 2.1);
    sign(g, '♨ 온천 요양원', { w: 3.2, h: 0.6, bg: '#c92a2a', fg: '#fff', y: 1.9, z: 1.65 });
    const steam: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      p.userData = { phase: i / 6, x: -2.5 + (i % 3) * 2.5 };
      g.add(p); steam.push(p);
    }
    g.userData.steam = steam;
  },
  castle(g) {
    const M = mats();
    const purple = toonMaterial(0x7048e8, { specular: 0.5 });
    box(g, 8, 3.2, 3.4, M.stone, 0, 0, -0.8);
    for (const x of [-4.4, 4.4]) { cyl(g, 1.1, 1.2, 5.2, M.stone, x, 0, -0.4, 16); cone(g, 1.4, 2.4, purple, x, 5.2, -0.4, 16); }
    cyl(g, 1.3, 1.4, 7, M.stone, 0, 0, -1, 16);
    cone(g, 1.7, 3, purple, 0, 7, -1, 16);
    cone(g, 0.1, 0.6, M.gold, 0, 10, -1, 6);
    box(g, 1.6, 2.2, 0.2, M.wood, 0, 0, 0.95);
    for (let i = -3; i <= 3; i++) box(g, 0.6, 0.5, 0.6, M.stone, i * 1.15, 3.2, 0.6);
  },
};

export function landmarkCandidates(tileX: number, tileZ: number): [number, number, 1 | -1][] {
  const { ROW, RS } = LAYOUT;
  const x = Math.max(-ROW / 2 + 7, Math.min(ROW / 2 - 7, tileX));
  const laneZ = Math.round(tileZ / RS) * RS;
  const out: [number, number, 1 | -1][] = [];
  for (const dx of [0, -12, 12, -24, 24]) for (const s of [1, -1] as const) out.push([x + dx, laneZ + s * BLOCK_OFF, s]);
  return out;
}

function animate(ctx: CityCtx, g: THREE.Group) {
  const jet = g.userData.jet as THREE.Mesh | undefined;
  if (jet) ctx.updaters.push((t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.08; });
  const steam = g.userData.steam as THREE.Mesh[] | undefined;
  if (steam) ctx.updaters.push((t) => {
    for (const puff of steam) {
      const ph = (t * 0.25 + puff.userData.phase) % 1;
      puff.position.set(puff.userData.x + Math.sin(ph * 6 + puff.userData.x) * 0.3, 3 + ph * 4, -0.5);
      puff.scale.setScalar(0.6 + ph * 1.4);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - ph);
    }
  });
}

export function placeLandmarks(ctx: CityCtx): void {
  const { ROW, RS } = LAYOUT;
  const { scene, occupied, board, zMin, zMax, side } = ctx;
  const place = (type: LandmarkType, tile: number) => {
    const p = board.tilePos[tile];
    for (const [cx, cz, s] of landmarkCandidates(p.x, p.z)) {
      if (Math.abs(cx) > ROW / 2 - 6) continue;
      const r: Rect = { x0: cx - 6, x1: cx + 6, z0: cz - BLOCK_DEPTH / 2, z1: cz + BLOCK_DEPTH / 2 };
      if (occupied.some((o) => overlaps(r, o))) continue;
      if (cz < zMin || cz > zMax) continue;
      if (ctx.tileNear(r)) continue;
      occupied.push(r);
      const g = new THREE.Group();
      BUILDERS[type](g);
      g.position.set(cx, 0.02, cz);
      g.rotation.y = s > 0 ? Math.PI : 0;
      scene.add(g);
      animate(ctx, g);
      return;
    }
  };
  ERAS.forEach((era, ei) => {
    const d = DISTRICTS[era.id];
    const s0 = BOARD.eraStart[ei]; const s1 = BOARD.eraEnd[ei];
    if (d.stop) {
      const st = BOARD.tiles.find((t) => t.era === ei && t.type === 'stop');
      if (st) place(d.stop, st.i);
    }
    place(d.at30, Math.round(s0 + (s1 - s0) * 0.3));
    place(d.at70, Math.round(s0 + (s1 - s0) * 0.7));
  });

  // 마리나
  const M = mats();
  const zc = Math.round(((board.tilePos[BOARD.eraStart[5]].z + board.tilePos[BOARD.eraEnd[5]].z) / 2) / RS) * RS + RS / 2 + 5;
  const x0 = -side - ROAD_W / 2 - 1;
  const len = x0 - (ctx.env.island.cx - ctx.env.island.hx - 14);
  const pier = new THREE.Group();
  box(pier, len, 0.25, 2.4, M.wood, 0, 0.25, 0);
  for (let x = -len / 2; x <= len / 2; x += 2.5) for (const z of [-1.1, 1.1]) cyl(pier, 0.12, 0.12, 2.2, M.wood, x, -1.6, z, 6);
  pier.position.set(x0 - len / 2, 0, zc);
  scene.add(pier);
  occupied.push({ x0: x0 - len, x1: x0, z0: zc - 7, z1: zc + 7 });
  const boats: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const hull = outlined(b, new THREE.CylinderGeometry(0.9, 0.5, 3.2, 12, 1), toonMaterial(0xffffff, { specular: 0.8 }));
    hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.55); hull.position.y = 0.2;
    box(b, 1.2, 0.6, 0.8, toonMaterial(0x74c0fc, { specular: 0.8 }), -0.2, 0.55, 0);
    cyl(b, 0.05, 0.05, 3.6, M.white, 0.3, 0.55, 0, 6);
    const sailG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.35, 0.9, 0), new THREE.Vector3(0.35, 4, 0), new THREE.Vector3(1.8, 0.9, 0)]);
    sailG.computeVertexNormals();
    b.add(new THREE.Mesh(sailG, toonMaterial(0xfff9db, { side: THREE.DoubleSide })));
    b.position.set(x0 - 4 - i * 3, -1.0, zc + (i % 2 ? 2.8 : -2.8));
    b.userData.ph = i * 1.3;
    scene.add(b);
    boats.push(b);
  }
  ctx.updaters.push((t) => {
    for (const b of boats) {
      b.position.y = -0.95 + Math.sin(t * 1.4 + b.userData.ph) * 0.12;
      b.rotation.z = Math.sin(t * 1.1 + b.userData.ph) * 0.05;
      b.rotation.x = Math.sin(t * 0.9 + b.userData.ph) * 0.04;
    }
  });

  // GOAL 성
  const gp = board.tilePos[BOARD.eraEnd[BOARD.eraEnd.length - 1]];
  const castle = new THREE.Group();
  BUILDERS.castle(castle);
  const cz = zMax + ROAD_W / 2 + 4.5;
  castle.position.set(Math.max(-ROW / 2 + 6, Math.min(ROW / 2 - 6, gp.x)), 0.02, cz);
  scene.add(castle);
  occupied.push({ x0: castle.position.x - 6, x1: castle.position.x + 6, z0: cz - 3, z1: cz + 3 });
}
