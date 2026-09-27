// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 맵(도시) 구성: 도로·인도·횡단보도·가로등·주행 차량, 시대별 구역 랜드마크, 마리나, 나무·집 (docs/ADR.md §12.3, §12.5)
import * as THREE from 'three';
import { BOARD } from '/shared/board.js';
import { ERAS } from '/shared/data.js';
import { toonMaterial, outlineMaterial, roadMaterial, buildingMaterial } from './shaders.js';
import { outlined } from './avatar.js';

// 시대별 랜드마크 (§12.5)
export const DISTRICTS = {
  baby: { at30: 'hospital', at70: 'playground' },
  elem: { at30: 'schoolElem', at70: 'field' },
  middle: { at30: 'schoolMiddle', at70: 'gym' },
  high: { at30: 'schoolHigh', at70: 'library' },
  adult1: { at30: 'offices', at70: 'apartments', stop: 'chapel' },
  adult2: { at30: 'mall', at70: 'offices', stop: 'mansion', edge: 'marina' },
  final: { at30: 'park', at70: 'onsen', edge: 'castle' },
};

const ROAD_W = 4.8; // 차도 3.2 + 인도 0.8 × 2
const BLOCK_OFF = 4.75; // 레인 중심에서 블록 중심까지
const BLOCK_DEPTH = 6; // 블록 깊이 (z)

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 형상 도우미 ----------
function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, opt = {}) {
  const m = outlined(parent, new THREE.BoxGeometry(w, h, d), mat, opt);
  m.position.set(x, y + h / 2, z);
  return m;
}
function cyl(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, opt = {}) {
  const m = outlined(parent, new THREE.CylinderGeometry(rt, rb, h, seg), mat, opt);
  m.position.set(x, y + h / 2, z);
  return m;
}
function cone(parent, r, h, mat, x = 0, y = 0, z = 0, seg = 16, opt = {}) {
  const m = outlined(parent, new THREE.ConeGeometry(r, h, seg), mat, opt);
  m.position.set(x, y + h / 2, z);
  return m;
}
// 박공 지붕 (x 폭 w, 높이 h, z 깊이 d)
function gable(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  const m = outlined(parent, g, mat);
  m.position.set(x, y, z);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function sign(parent, text, { w = 3, h = 0.8, bg = '#ffffff', fg = '#2a2238', x = 0, y = 3, z = 0 } = {}) {
  const tex = canvasTex(512, Math.round((512 * h) / w), (g, cw, ch) => {
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.fillStyle = fg; g.font = `bold ${Math.round(ch * 0.62)}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function clockFace(parent, r, x, y, z) {
  const tex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
    g.lineWidth = 12; g.strokeStyle = '#3b2f2f'; g.stroke();
    g.fillStyle = '#3b2f2f';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 92 - 5, 128 + Math.sin(a) * 92 - 5, 10, 10); }
    g.lineCap = 'round'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(180, 150); g.stroke();
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const texToon = (map) => new THREE.MeshToonMaterial({ map });

// ---------- 랜드마크 (로컬 좌표: 앞면 = +z, 바닥 y=0, 폭 ≤ 12, 깊이 ≤ 6) ----------
const MAT = {};
function mats() {
  if (MAT.white) return MAT;
  MAT.white = toonMaterial(0xffffff);
  MAT.cream = toonMaterial(0xfff4dc);
  MAT.red = toonMaterial(0xe03131, { specular: 0.4 });
  MAT.roofRed = toonMaterial(0xd6453d, { specular: 0.35 });
  MAT.roofBlue = toonMaterial(0x4c6ef5, { specular: 0.35 });
  MAT.roofGreen = toonMaterial(0x2f9e44, { specular: 0.3 });
  MAT.dark = toonMaterial(0x495057);
  MAT.wood = toonMaterial(0x9c6b43);
  MAT.gold = toonMaterial(0xffd43b, { specular: 0.9, rim: 0.6 });
  MAT.hedge = toonMaterial(0x3aa04d, { rim: 0.3 });
  MAT.grass = toonMaterial(0x7cc56a, { grass: 1, rim: 0 });
  MAT.sand = toonMaterial(0xf1dca0, { rim: 0 });
  MAT.pave = toonMaterial(0xe9e2d0, { rim: 0 });
  MAT.water = toonMaterial(0x4fc3f7, { specular: 0.9, rim: 0.5, emissive: 0x0b3a55 });
  MAT.stone = buildingMaterial(0xd8d2c4, { brick: true });
  MAT.hospital = buildingMaterial(0xffffff, { win: [1.3, 1.2], glass: 0x74c0fc });
  MAT.brick = buildingMaterial(0xb5563b, { win: [1.25, 1.25], brick: true, glass: 0x8fd3ff });
  MAT.schoolCream = buildingMaterial(0xf3e3c3, { win: [1.25, 1.25], glass: 0x8fd3ff });
  MAT.schoolGray = buildingMaterial(0xd9dde3, { win: [1.25, 1.25], glass: 0x8fd3ff });
  MAT.office1 = buildingMaterial(0xdfe7ef, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 });
  MAT.office2 = buildingMaterial(0xa5d8ff, { win: [0.9, 1.0], glass: 0x2f6fb0, specular: 0.5 });
  MAT.office3 = buildingMaterial(0xffe8cc, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 });
  MAT.apt = buildingMaterial(0xfff0e6, { win: [1.1, 1.2], glass: 0x74c0fc });
  MAT.aptPink = buildingMaterial(0xffdeeb, { win: [1.1, 1.2], glass: 0x74c0fc });
  MAT.mall = buildingMaterial(0xfdfdfd, { win: [2.0, 1.4], glass: 0x66d9e8, floor0: 0.3 });
  MAT.mansion = buildingMaterial(0xfffaf0, { win: [1.4, 1.3], glass: 0x8fd3ff });
  MAT.library = buildingMaterial(0xf1e0c5, { win: [1.4, 1.3], glass: 0x8fd3ff });
  MAT.gym = buildingMaterial(0xe7f5ff, { win: [1.6, 1.2], glass: 0x74c0fc });
  MAT.onsen = buildingMaterial(0xc99a6b, { win: [1.5, 1.2], glass: 0xffe8a3 });
  MAT.house = buildingMaterial(0xffffff, { win: [1.2, 1.1], glass: 0x8fd3ff, floor0: 0.4, vertexColors: false });
  MAT.tower = buildingMaterial(0xffffff, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 });
  return MAT;
}

function schoolBuilding(g, wallMat, roofMat) {
  const M = mats();
  box(g, 10, 3.6, 4.2, wallMat, 0, 0, -0.6);
  box(g, 10.4, 0.25, 4.6, M.white, 0, 3.6, -0.6);
  box(g, 2.6, 6.6, 2.6, wallMat, 0, 0, 0.4);
  cone(g, 2.3, 1.8, roofMat, 0, 6.6, 0.4, 4).rotation.y = Math.PI / 4;
  clockFace(g, 0.8, 0, 5.4, 1.72);
  box(g, 1.6, 1.6, 0.3, M.white, 0, 0, 1.8); // 현관
  box(g, 11, 0.4, 0.3, M.hedge, 0, 0, 2.6);
}

const BUILDERS = {
  hospital(g) {
    const M = mats();
    box(g, 9, 4.6, 4.6, M.hospital, 0, 0, -0.4);
    box(g, 9.3, 0.3, 4.9, M.white, 0, 4.6, -0.4);
    box(g, 3, 0.25, 1.6, toonMaterial(0x74c0fc), 0, 2.1, 2.3); // 현관 차양
    for (const x of [-1.3, 1.3]) cyl(g, 0.1, 0.1, 2.1, M.white, x, 0, 2.9, 8);
    box(g, 0.5, 1.6, 0.2, M.red, 0, 3.5, 1.95); // 빨간 십자
    box(g, 1.6, 0.5, 0.2, M.red, 0, 4.05, 1.95);
    sign(g, '산부인과', { w: 2.6, h: 0.6, bg: '#e03131', fg: '#fff', x: 2.7, y: 3.4, z: 1.92 });
  },
  playground(g) {
    const M = mats();
    box(g, 10.5, 0.08, 5.5, M.sand, 0, 0, 0, { outline: false });
    // 미끄럼틀
    box(g, 1.3, 1.9, 1.3, toonMaterial(0xffd43b), -3.3, 0, -0.8);
    const slide = box(g, 1.1, 0.12, 3.2, toonMaterial(0xff6b6b, { specular: 0.6 }), -3.3, 0.9, 1.2);
    slide.rotation.x = 0.55;
    // 그네
    const blue = toonMaterial(0x4dabf7);
    for (const x of [0.6, 3.8]) for (const dz of [-0.6, 0.6]) { const leg = cyl(g, 0.08, 0.08, 2.6, blue, x, 0, dz, 6); leg.rotation.x = dz > 0 ? -0.2 : 0.2; }
    const bar = cyl(g, 0.08, 0.08, 3.4, blue, 2.2, 2.45, 0, 6); bar.rotation.z = Math.PI / 2; bar.position.y = 2.5;
    for (const x of [1.5, 2.9]) { box(g, 0.6, 0.08, 0.35, M.red, x, 0.6, 0); for (const dx of [-0.25, 0.25]) cyl(g, 0.02, 0.02, 1.85, M.dark, x + dx, 0.65, 0, 4, { outline: false }); }
    // 시소
    const ss = box(g, 3, 0.15, 0.4, toonMaterial(0x51cf66), 2.2, 0.35, 2.1); ss.rotation.z = 0.15;
    box(g, 0.3, 0.4, 0.3, M.dark, 2.2, 0, 2.1);
  },
  schoolElem(g) { const M = mats(); schoolBuilding(g, M.brick, M.roofGreen); },
  schoolMiddle(g) { const M = mats(); schoolBuilding(g, M.schoolCream, M.roofBlue); },
  schoolHigh(g) { const M = mats(); schoolBuilding(g, M.schoolGray, M.roofRed); },
  field(g) {
    const tex = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#5fbf5a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d9534f'; c.lineWidth = 46;
      const track = (pad) => { c.beginPath(); c.moveTo(128, pad); c.lineTo(384, pad); c.arc(384, 128, 128 - pad, -Math.PI / 2, Math.PI / 2); c.lineTo(128, 256 - pad); c.arc(128, 128, 128 - pad, Math.PI / 2, Math.PI * 1.5); c.stroke(); };
      track(30);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; track(16); track(30); track(44);
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(200, 96, 112, 64);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.6), texToon(tex));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.receiveShadow = true;
    g.add(m);
    const M = mats();
    for (const x of [-4.8, 4.8]) { cyl(g, 0.06, 0.06, 1.8, M.white, x, 0, 0, 6); box(g, 0.1, 0.7, 1.6, M.white, x, 1.1, 0, { outline: false }); }
  },
  gym(g) {
    const M = mats();
    box(g, 9, 2.8, 4.8, M.gym, 0, 0, -0.3);
    const roof = outlined(g, new THREE.CylinderGeometry(2.6, 2.6, 9.2, 24, 1, false, 0, Math.PI), toonMaterial(0x15aabf, { specular: 0.6 }));
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.rotation.x = 0;
    roof.rotation.set(0, 0, Math.PI / 2); roof.rotation.y = 0;
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
    const hs = [[-3.6, 9, M.office1], [0.2, 12.5, M.office2], [3.8, 7, M.office3]];
    for (const [x, h, mat] of hs) {
      box(g, 3.2, h, 3.6, mat, x, 0, -0.6);
      box(g, 3.4, 0.25, 3.8, M.white, x, h, -0.6);
      box(g, 1, 0.7, 1, M.dark, x + 0.6, h + 0.25, -0.8);
    }
  },
  apartments(g) {
    const M = mats();
    for (const [x, mat, h] of [[-2.9, M.apt, 7.2], [2.9, M.aptPink, 6]]) {
      box(g, 5, h, 3.4, mat, x, 0, -0.8);
      box(g, 5.2, 0.25, 3.6, M.white, x, h, -0.8);
      for (let y = 1.2; y < h - 0.5; y += 1.2) box(g, 5, 0.12, 0.5, M.white, x, y, 1.1, { outline: false }); // 베란다
    }
  },
  chapel(g) {
    const M = mats();
    box(g, 6, 3.4, 4.4, M.white, 1, 0, -0.5);
    gable(g, 6.6, 2.4, 4.8, toonMaterial(0x91a7ff, { specular: 0.4 }), 1, 3.4, -0.5).rotation.y = Math.PI / 2;
    box(g, 1.8, 6.2, 1.8, M.white, -3.4, 0, 0.4);
    cone(g, 1.4, 2.2, toonMaterial(0x91a7ff, { specular: 0.4 }), -3.4, 6.2, 0.4, 4).rotation.y = Math.PI / 4;
    const bell = outlined(g, new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold);
    bell.position.set(-3.4, 4.8, 1.32); bell.rotation.x = Math.PI;
    cone(g, 0.12, 0.5, M.gold, -3.4, 8.4, 0.4, 6);
    box(g, 1.6, 2.2, 0.2, toonMaterial(0xffc9de), 1, 0, 1.8); // 문
    sign(g, '♥ WEDDING', { w: 3, h: 0.6, bg: '#ff8fab', fg: '#fff', x: 1, y: 2.75, z: 1.72 });
  },
  mall(g) {
    const M = mats();
    box(g, 11, 3.4, 5.2, M.mall, 0, 0, -0.2);
    box(g, 11.4, 0.3, 5.6, toonMaterial(0xff922b), 0, 3.4, -0.2);
    const cols = [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8];
    cols.forEach((c, i) => { const aw = box(g, 2.1, 0.12, 1, toonMaterial(c), -4.4 + i * 2.2, 2.2, 2.8); aw.rotation.x = 0.35; });
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
    const plaza = outlined(g, new THREE.CylinderGeometry(2.6, 2.6, 0.08, 32), M.pave, { outline: false });
    plaza.position.y = 0.07;
    cyl(g, 1.6, 1.7, 0.5, M.stone, 0, 0.08, 0, 24);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.1, 24), M.water);
    w.position.y = 0.52; g.add(w);
    cyl(g, 0.25, 0.35, 1.2, M.stone, 0, 0.5, 0, 12);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xd0f4ff, transparent: true, opacity: 0.55, depthWrite: false }));
    jet.position.y = 2.4; jet.rotation.x = Math.PI; g.add(jet);
    g.userData.jet = jet;
    for (const [x, z, r] of [[-4, -1.5, 0], [4, -1.5, 0], [-4, 1.6, 0], [4, 1.6, 0]]) {
      box(g, 1.6, 0.35, 0.5, M.wood, x, 0.3, z); box(g, 1.6, 0.5, 0.12, M.wood, x, 0.65, z - 0.2);
      void r;
    }
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
    const steam = [];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      p.userData.phase = i / 6; p.userData.x = -2.5 + (i % 3) * 2.5; g.add(p); steam.push(p);
    }
    g.userData.steam = steam;
  },
  castle(g) {
    const M = mats();
    box(g, 8, 3.2, 3.4, M.stone, 0, 0, -0.8);
    for (const x of [-4.4, 4.4]) { cyl(g, 1.1, 1.2, 5.2, M.stone, x, 0, -0.4, 16); cone(g, 1.4, 2.4, toonMaterial(0x7048e8, { specular: 0.5 }), x, 5.2, -0.4, 16); }
    cyl(g, 1.3, 1.4, 7, M.stone, 0, 0, -1, 16);
    cone(g, 1.7, 3, toonMaterial(0x7048e8, { specular: 0.5 }), 0, 7, -1, 16);
    cone(g, 0.1, 0.6, M.gold, 0, 10, -1, 6);
    box(g, 1.6, 2.2, 0.2, M.wood, 0, 0, 0.95);
    for (let i = -3; i <= 3; i++) box(g, 0.6, 0.5, 0.6, M.stone, i * 1.15, 3.2, 0.6);
  },
};

// ---------- 맵 생성 ----------
export function buildCity(world, { ROW, RS, STEP }) {
  const scene = world.scene;
  const rng = mulberry(4242);
  const tilePos = world.tilePos;
  const mainTiles = BOARD.tiles.filter((t) => t.era >= 0);
  const n = tilePos.length;
  const rows = Math.round(Math.max(...mainTiles.map((t) => t.z)) / RS) + 1;
  void STEP;
  const tileNear = (r, m = 1.9) => mainTiles.some((t) => t.x > r.x0 - m && t.x < r.x1 + m && t.z > r.z0 - m && t.z < r.z1 + m);
  const side = ROW / 2 + 8;
  const occupied = []; // {x0,x1,z0,z1}
  const updaters = [];
  const inRect = (x, z, m = 0) => occupied.some((r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m);

  // ----- 도로 -----
  const roadZs = [];
  for (let k = -1; k < rows; k++) roadZs.push(k * RS + RS / 2);
  const zMin = roadZs[0];
  const zMax = roadZs[roadZs.length - 1];
  const rmat = roadMaterial();
  const addRoad = (cx, cz, len, horizontal) => {
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
  // 세로 골목길: 레인을 가로질러 도시 블록을 나눔 (docs/ADR.md §12.3)
  const VXS = [-15, 0, 15];
  for (const vx of VXS) addRoad(vx, (zMax + zMin) / 2, zMax - zMin, false);
  for (const sx of [-side, side]) addRoad(sx, (zMax + zMin) / 2, zMax - zMin + ROAD_W, false);
  const roadDist = (x, z) => {
    let best = Infinity;
    if (Math.abs(x) <= side + ROAD_W) for (const rz of roadZs) best = Math.min(best, Math.abs(z - rz));
    if (z >= zMin - ROAD_W && z <= zMax + ROAD_W) {
      best = Math.min(best, Math.abs(Math.abs(x) - side));
      for (const vx of VXS) best = Math.min(best, Math.abs(x - vx));
    }
    return best;
  };
  world.roadDist = roadDist;

  // 횡단보도: 보드 길(연결 구간)이 도로를 건너는 곳
  const white = toonMaterial(0xffffff, { rim: 0 });
  const stripeG = new THREE.BoxGeometry(0.42, 0.02, 3.1);
  const cross = [];
  for (let k = 0; k < rows - 1; k++) {
    const cx = k % 2 === 0 ? ROW / 2 : -ROW / 2;
    for (let i = -3; i <= 3; i++) cross.push([cx + i * 0.8, 0.075, k * RS + RS / 2]);
  }
  const cim = new THREE.InstancedMesh(stripeG, white, cross.length);
  const m4 = new THREE.Matrix4();
  cross.forEach((p, i) => { m4.makeTranslation(...p); cim.setMatrixAt(i, m4); });
  cim.receiveShadow = true;
  scene.add(cim);

  // 가로등 (인도, 12 간격)
  const lamps = [];
  for (const z of roadZs) {
    for (let x = -side + 6; x <= side - 6; x += 12) {
      if (Math.abs(Math.abs(x) - ROW / 2) < 3 || VXS.some((vx) => Math.abs(x - vx) < 3)) continue;
      lamps.push([x, z + (lamps.length % 2 ? 1 : -1) * (ROAD_W / 2 - 0.3)]);
    }
  }
  const poleG = new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6); poleG.translate(0, 1.3, 0);
  const headG = new THREE.SphereGeometry(0.22, 10, 8); headG.translate(0, 2.7, 0);
  const pole = new THREE.InstancedMesh(poleG, toonMaterial(0x495057), lamps.length);
  const head = new THREE.InstancedMesh(headG, toonMaterial(0xfff3bf, { emissive: 0x6b5a1a, rim: 0.2 }), lamps.length);
  lamps.forEach(([x, z], i) => { m4.makeTranslation(x, 0.05, z); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
  pole.castShadow = true;
  scene.add(pole, head);

  // 주행 차량
  const carColors = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x51cf66, 0xffffff, 0xcc5de8, 0xff922b];
  const bodyG = new THREE.BoxGeometry(1.5, 0.5, 0.8);
  const cabG = new THREE.BoxGeometry(0.8, 0.4, 0.7);
  const wheelG = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10); wheelG.rotateX(Math.PI / 2);
  const tireM = toonMaterial(0x2b2b2b);
  const glassM = toonMaterial(0x9fd4ff, { specular: 0.9 });
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const car = new THREE.Group();
    const bm = toonMaterial(carColors[i % carColors.length], { specular: 0.7, rim: 0.4 });
    const b = outlined(car, bodyG, bm); b.position.y = 0.42;
    const c = outlined(car, cabG, glassM); c.position.set(-0.1, 0.87, 0);
    for (const [x, z] of [[-0.5, 0.38], [0.5, 0.38], [-0.5, -0.38], [0.5, -0.38]]) { const w = new THREE.Mesh(wheelG, tireM); w.position.set(x, 0.17, z); car.add(w); }
    const dir = i % 2 ? 1 : -1;
    const rz = roadZs[Math.floor(rng() * roadZs.length)];
    car.userData = { dir, speed: 3.5 + rng() * 3, x: -side + rng() * side * 2, z: rz + dir * 0.75 };
    car.rotation.y = dir > 0 ? 0 : Math.PI;
    scene.add(car);
    cars.push(car);
  }
  updaters.push((t, dt) => {
    for (const car of cars) {
      const u = car.userData;
      u.x += u.dir * u.speed * dt;
      if (u.x > side) u.x = -side;
      if (u.x < -side) u.x = side;
      // 횡단보도 앞에서 말이 지나갈 때를 흉내내어 잠깐 감속
      const nearCross = Math.abs(Math.abs(u.x) - ROW / 2) < 3;
      car.position.set(u.x, 0.06, u.z);
      car.children[0].position.y = 0.42 + Math.sin(t * 12 + u.x) * (nearCross ? 0 : 0.015);
    }
  });

  // ----- 랜드마크 -----
  const placeLandmark = (type, tileIdx, rot = null) => {
    const build = BUILDERS[type];
    if (!build) return;
    const p = tilePos[tileIdx];
    // 연결 구간(세로)에 있으면 레인 안쪽으로
    let x = Math.max(-ROW / 2 + 7, Math.min(ROW / 2 - 7, p.x));
    const laneZ = Math.round(p.z / RS) * RS;
    const candidates = [];
    for (const dx of [0, -12, 12, -24, 24]) for (const s of [1, -1]) candidates.push([x + dx, laneZ + s * BLOCK_OFF, s]);
    for (const [cx, cz, s] of candidates) {
      if (Math.abs(cx) > ROW / 2 - 6) continue;
      const r = { x0: cx - 6, x1: cx + 6, z0: cz - BLOCK_DEPTH / 2, z1: cz + BLOCK_DEPTH / 2 };
      if (occupied.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.z0 < o.z1 && r.z1 > o.z0)) continue;
      if (cz < zMin || cz > zMax) continue;
      if (tileNear(r)) continue; // 우회로(커리어 길) 칸과 겹치지 않게
      occupied.push(r);
      const g = new THREE.Group();
      build(g);
      g.position.set(cx, 0.02, cz);
      g.rotation.y = rot ?? (s > 0 ? Math.PI : 0); // 앞면이 레인을 향함
      scene.add(g);
      if (g.userData.jet) updaters.push((t) => { g.userData.jet.scale.y = 1 + Math.sin(t * 6) * 0.08; });
      if (g.userData.steam) updaters.push((t) => {
        for (const puff of g.userData.steam) {
          const ph = (t * 0.25 + puff.userData.phase) % 1;
          puff.position.set(puff.userData.x + Math.sin(ph * 6 + puff.userData.x) * 0.3, 3 + ph * 4, -0.5);
          puff.scale.setScalar(0.6 + ph * 1.4);
          puff.material.opacity = 0.55 * (1 - ph);
        }
      });
      return g;
    }
    return null;
  };

  ERAS.forEach((era, ei) => {
    const d = DISTRICTS[era.id];
    if (!d) return;
    const s0 = BOARD.eraStart[ei];
    const s1 = BOARD.eraEnd[ei];
    if (d.stop) {
      const st = BOARD.tiles.find((t) => t.era === ei && t.type === 'stop');
      if (st) placeLandmark(d.stop, st.i);
    }
    placeLandmark(d.at30, Math.round(s0 + (s1 - s0) * 0.3));
    placeLandmark(d.at70, Math.round(s0 + (s1 - s0) * 0.7));
  });

  // 섬 가장자리: 마리나 (어른 후반 레인 높이, 서쪽 해안)
  {
    const zc = Math.round(((tilePos[BOARD.eraStart[5]].z + tilePos[BOARD.eraEnd[5]].z) / 2) / RS) * RS + RS / 2 + 5;
    const x0 = -side - ROAD_W / 2 - 1;
    const edge = -world.islandHalf.x;
    const M = mats();
    const pier = new THREE.Group();
    const len = x0 - (edge - 14);
    box(pier, len, 0.25, 2.4, M.wood, 0, 0.25, 0);
    for (let x = -len / 2; x <= len / 2; x += 2.5) for (const z of [-1.1, 1.1]) cyl(pier, 0.12, 0.12, 2.2, M.wood, x, -1.6, z, 6);
    pier.position.set(x0 - len / 2, 0, zc);
    scene.add(pier);
    occupied.push({ x0: x0 - len, x1: x0, z0: zc - 7, z1: zc + 7 });
    const boats = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group();
      const hull = outlined(b, new THREE.CylinderGeometry(0.9, 0.5, 3.2, 12, 1), toonMaterial(0xffffff, { specular: 0.8 }));
      hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.55); hull.position.y = 0.2;
      box(b, 1.2, 0.6, 0.8, toonMaterial(0x74c0fc, { specular: 0.8 }), -0.2, 0.55, 0);
      cyl(b, 0.05, 0.05, 3.6, M.white, 0.3, 0.55, 0, 6);
      const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.35, 0.9, 0), new THREE.Vector3(0.35, 4, 0), new THREE.Vector3(1.8, 0.9, 0)]), toonMaterial(0xfff9db, { side: THREE.DoubleSide }));
      sail.geometry.computeVertexNormals();
      b.add(sail);
      const bx = x0 - 4 - i * 3;
      const bz = zc + (i % 2 ? 2.8 : -2.8);
      b.position.set(bx, -1.0, bz);
      b.userData = { bx, bz, ph: i * 1.3 };
      scene.add(b);
      boats.push(b);
    }
    updaters.push((t) => {
      for (const b of boats) {
        b.position.y = -0.95 + Math.sin(t * 1.4 + b.userData.ph) * 0.12;
        b.rotation.z = Math.sin(t * 1.1 + b.userData.ph) * 0.05;
        b.rotation.x = Math.sin(t * 0.9 + b.userData.ph) * 0.04;
      }
    });
  }

  // GOAL 성 (마지막 레인 너머)
  {
    const gp = tilePos[BOARD.eraEnd[BOARD.eraEnd.length - 1]];
    const g = new THREE.Group();
    BUILDERS.castle(g);
    const cz = zMax + ROAD_W / 2 + 4.5;
    g.position.set(Math.max(-ROW / 2 + 6, Math.min(ROW / 2 - 6, gp.x)), 0.02, cz);
    scene.add(g);
    occupied.push({ x0: g.position.x - 6, x1: g.position.x + 6, z0: cz - 3, z1: cz + 3 });
  }

  // ----- 집·나무 채우기 -----
  const trunks = []; const leaves = []; const pines = []; const houses = []; const towers = []; const toys = [];
  const placed = [];
  const hx = world.islandHalf.x; const hz = world.islandHalf.y;
  const cxI = world.islandCenter.x; const czI = world.islandCenter.y;
  const sd = (x, z) => {
    const qx = Math.abs(x - cxI) - hx + world.islandRadius;
    const qz = Math.abs(z - czI) - hz + world.islandRadius;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - world.islandRadius;
  };
  const shops = [];
  const eraAt = (x, z) => ERAS[BOARD.tiles[world.pathDist(x, z)[1]].era].id;
  const HOUSE_C = [0xfff5e6, 0xffe3e3, 0xe7f5ff, 0xfff9db, 0xe6fcf5];
  const ROOF_C = [0xe8590c, 0x1971c2, 0x2f9e44, 0xc2255c, 0xd6453d];
  const TOWER_C = [0xdee2e6, 0xa5d8ff, 0xffd8a8, 0xd0bfff, 0xc3fae8];
  const AWNING_C = [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8, 0xff922b];
  // 도시 블록 채우기: 레인과 도로 사이 띠를 골목길로 나눈 칸마다 도로를 바라보는 건물을 촘촘히 (원작 화면처럼 빽빽한 도시)
  const cells = [[-side + 3.2, VXS[0] - 2.8], [VXS[0] + 2.8, VXS[1] - 2.8], [VXS[1] + 2.8, VXS[2] - 2.8], [VXS[2] + 2.8, side - 3.2]];
  for (let k = 0; k < rows; k++) {
    for (const sgn of [1, -1]) {
      const zc = k * RS + sgn * 5.2;
      if (zc < zMin + 2 || zc > zMax - 2) continue;
      for (const [xa, xb] of cells) {
        for (let x = xa + 1.6; x <= xb - 1.4; x += 3.3) {
          const r = { x0: x - 1.5, x1: x + 1.5, z0: zc - 1.6, z1: zc + 1.6 };
          if (occupied.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.z0 < o.z1 && r.z1 > o.z0)) continue;
          if (tileNear(r, 1.5)) continue;
          if (rng() < 0.12) continue; // 가끔 빈 터(나무 자리)
          const eraId = eraAt(x, zc);
          const rot = sgn > 0 ? 0 : Math.PI; // 앞면이 도로 쪽
          const y = 0.02;
          placed.push({ x, z: zc });
          const adult = eraId === 'adult1' || eraId === 'adult2';
          const roll = rng();
          if (eraId === 'baby' && roll < 0.35) toys.push({ x, y, z: zc, s: 0.9, rot, c: [0xff8787, 0x74c0fc, 0xffe066, 0x8ce99a][Math.floor(rng() * 4)] });
          else if (adult && roll < 0.45) towers.push({ x, y, z: zc, s: 1.25, h: 4 + rng() * 6, rot, c: TOWER_C[Math.floor(rng() * TOWER_C.length)] });
          else if (roll < (adult ? 0.75 : 0.35)) shops.push({ x, y, z: zc, rot, c: HOUSE_C[Math.floor(rng() * HOUSE_C.length)], a: AWNING_C[Math.floor(rng() * AWNING_C.length)], h: 1.8 + rng() * 1.6 });
          else houses.push({ x, y, z: zc, s: 1.2, rot, c: HOUSE_C[Math.floor(rng() * HOUSE_C.length)], roof: ROOF_C[Math.floor(rng() * ROOF_C.length)] });
        }
      }
    }
  }

  for (let k = 0; k < 2600; k++) {
    const x = cxI + (rng() * 2 - 1) * hx;
    const z = czI + (rng() * 2 - 1) * hz;
    if (sd(x, z) > -5) continue;
    const [pd, ti] = world.pathDist(x, z);
    if (pd < 3.4) continue;
    const rd = roadDist(x, z);
    if (rd < 3.0) continue;
    if (inRect(x, z, 1.2)) continue;
    if (placed.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 3.4 * 3.4)) continue;
    placed.push({ x, z });
    const y = world.terrainHeight(x, z);
    const eraId = ERAS[BOARD.tiles[ti].era].id;
    const s = 0.7 + rng() * 0.5;
    const facing = Math.abs(roadZs.reduce((b, rz) => (Math.abs(z - rz) < Math.abs(z - b) ? rz : b), roadZs[0]) - z) === rd ? 0 : Math.PI / 2;
    if (rd < 5.2 && pd > 3.6 && rng() < 0.75) {
      if (eraId === 'baby') toys.push({ x, y, z, s, rot: facing, c: [0xff8787, 0x74c0fc, 0xffe066, 0x8ce99a][Math.floor(rng() * 4)] });
      else if ((eraId === 'adult1' || eraId === 'adult2') && rng() < 0.45) towers.push({ x, y, z, s: s * 0.8, h: 3 + rng() * 4, rot: facing, c: [0xdee2e6, 0xa5d8ff, 0xffd8a8, 0xd0bfff][Math.floor(rng() * 4)] });
      else houses.push({ x, y, z, s, rot: facing, c: [0xfff5e6, 0xffe3e3, 0xe7f5ff, 0xfff9db][Math.floor(rng() * 4)], roof: [0xe8590c, 0x1971c2, 0x2f9e44, 0xc2255c, 0xd6453d][Math.floor(rng() * 5)] });
    } else if (rng() < 0.6) {
      const blossom = (eraId === 'baby' || eraId === 'elem' || eraId === 'final') && rng() < 0.4;
      const autumn = !blossom && rng() < 0.35; // 원작 화면의 노랑·주황 단풍나무
      trunks.push({ x, y, z, s });
      leaves.push({ x, y, z, s, c: blossom ? [0xf8a5c2, 0xf783ac, 0xfcc2d7][Math.floor(rng() * 3)] : autumn ? [0xffd43b, 0xffa94d, 0xfcc419, 0xff922b][Math.floor(rng() * 4)] : [0x69db7c, 0x8ce99a, 0x51cf66, 0xa9e34b][Math.floor(rng() * 4)] });
    } else pines.push({ x, y, z, s, c: [0x2f9e44, 0x37b24d, 0x40c057][Math.floor(rng() * 3)] });
  }
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const olMat = outlineMaterial(0x2a2238, 0.04);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const inst = (geo, list, mat, place) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      const [p, rot, sc, c] = place(o);
      q.setFromAxisAngle(up, rot);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      if (c != null) im.setColorAt(i, col.set(c));
    });
    im.castShadow = true;
    im.receiveShadow = true;
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
  inst(trunkG, trunks, toonMaterial(0x8d5a3b), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s, o.s), null]);
  inst(leafG, leaves, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s, o.s), o.c]);
  inst(pineG, pines, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s * 1.1, o.s), o.c]);
  const houseMat = buildingMaterial(0xffffff, { win: [1.0, 1.0], glass: 0x8fd3ff, floor0: 0.5 });
  const towerMat = buildingMaterial(0xffffff, { win: [0.9, 1.0], glass: 0x4a90d9, specular: 0.5 });
  inst(houseG, houses, houseMat, (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.c]);
  inst(roofG, houses, toonMaterial(0xffffff, { specular: 0.4 }), (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.roof]);
  inst(towerG, towers, towerMat, (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.h, o.s), o.c]);
  inst(toyG, toys, toonMaterial(0xffffff, { specular: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.c]);
  const shopG = new THREE.BoxGeometry(2.8, 1, 2.8); shopG.translate(0, 0.5, 0);
  const awnG = new THREE.BoxGeometry(2.9, 0.12, 0.9); awnG.translate(0, 0, 1.75);
  const roofSlabG = new THREE.BoxGeometry(3.0, 0.2, 3.0); roofSlabG.translate(0, 0.1, 0);
  const shopMat = buildingMaterial(0xffffff, { win: [1.1, 1.0], glass: 0x8fd3ff, floor0: 1.3 });
  inst(shopG, shops, shopMat, (o) => [V(o.x, o.y, o.z), o.rot, V(1, o.h, 1), o.c]);
  inst(awnG, shops, toonMaterial(0xffffff, { specular: 0.4 }), (o) => [V(o.x, o.y + 1.15, o.z), o.rot, V(1, 1, 1), o.a]);
  inst(roofSlabG, shops, toonMaterial(0xffffff), (o) => [V(o.x, o.y + o.h, o.z), o.rot, V(1, 1, 1), o.a]);

  // ----- 서브맵 섬 장식 (docs/ADR.md §12.5) -----
  for (const isl of world.subIslands || []) {
    const g = new THREE.Group();
    g.position.set(isl.cx, 0.02, isl.cz);
    scene.add(g);
    const M = mats();
    const back = -4.5; // 칸 두 줄(상대 z −3.5, +3.5) 뒤쪽(+z)으로 건물 배치: back + 12 ≈ +7.5 이후
    if (isl.id === 'countryside') {
      box(g, 4, 2.6, 3, toonMaterial(0xc92a2a), -8, 0, back + 14);
      gable(g, 4.6, 1.6, 3.4, toonMaterial(0xf8f9fa), -8, 2.6, back + 14).rotation.y = Math.PI / 2;
      cyl(g, 0.5, 0.7, 5, M.white, 9, 0, back + 14, 10);
      const blades = new THREE.Group(); blades.position.set(9, 5, back + 13.2); g.add(blades);
      for (let k = 0; k < 4; k++) { const b = box(blades, 0.35, 2.6, 0.08, M.wood, 0, 0, 0); b.position.y = 0; b.rotation.z = (k * Math.PI) / 2; b.geometry.translate(0, 1.3, 0); }
      updaters.push((t) => { blades.rotation.z = t * 1.2; });
      for (let k = 0; k < 5; k++) box(g, 1.4, 0.3, 3.4, toonMaterial(k % 2 ? 0x8d5a3b : 0x74b816), -3 + k * 1.6, 0, back + 14, { outline: false });
    } else if (isl.id === 'casino') {
      box(g, 12, 4.5, 3.6, buildingMaterial(0x2b2d42, { win: [1.2, 1.2], glass: 0xffd43b }), 0, 0, back + 15);
      box(g, 12.4, 0.5, 4, M.gold, 0, 4.5, back + 15);
      const cs = sign(g, '★ CASINO ★', { w: 7, h: 1.2, bg: '#c2255c', fg: '#ffe066', y: 3.2, z: back + 13.1 }); cs.rotation.y = Math.PI;
      for (const x of [-10, 10]) { cyl(g, 0.2, 0.3, 4, M.wood, x, 0, back + 13, 6); for (let k = 0; k < 5; k++) { const l = box(g, 2.2, 0.1, 0.6, toonMaterial(0x2f9e44), x, 4, back + 13); l.rotation.y = (k / 5) * Math.PI * 2; l.rotation.z = -0.4; } }
    } else if (isl.id === 'shrine') {
      const red = toonMaterial(0xe03131, { specular: 0.3 });
      box(g, 0.5, 5, 0.5, red, -10.4, 0, -2); box(g, 0.5, 5, 0.5, red, -10.4, 0, 2);
      const beam = box(g, 0.7, 0.5, 7.4, red, -10.4, 4.9, 0); void beam; box(g, 0.5, 0.35, 6.2, red, -10.4, 4.0, 0);
      box(g, 8, 3, 3.6, M.wood, 0, 0, back + 15);
      gable(g, 5.2, 2.2, 9.4, toonMaterial(0x343a40), 0, 3, back + 15).rotation.y = Math.PI / 2;
      for (const x of [-5, 5]) { box(g, 0.8, 0.6, 0.8, M.stone, x, 0, back + 12.2); box(g, 0.5, 0.9, 0.5, toonMaterial(0xfff3bf, { emissive: 0x554400 }), x, 0.6, back + 12.2); box(g, 1, 0.3, 1, M.stone, x, 1.5, back + 12.2); }
    }
    // 섬 둘레 나무
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const x = Math.cos(a) * (isl.hx - 2.5);
      const z = Math.sin(a) * (isl.hz - 2.5);
      if (z > 6 && Math.abs(x) < 8) continue;
      cyl(g, 0.15, 0.22, 1.2, toonMaterial(0x8d5a3b), x, 0, z, 6);
      const leaf = outlined(g, new THREE.IcosahedronGeometry(1, 1), toonMaterial(isl.id === 'shrine' ? 0xf8a5c2 : isl.id === 'casino' ? 0x40c057 : 0x8ce99a, { rim: 0.4 }));
      leaf.position.set(x, 1.9, z);
    }
  }

  return {
    update(t, dt) { for (const u of updaters) u(t, dt); },
    occupied,
  };
}
