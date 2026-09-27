// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// Three.js 월드: 섬 지형, 보드, 말, 카메라, 후처리
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BOARD } from '/shared/board.js';
import { ERAS, TILE_INFO } from '/shared/data.js';
import {
  toonMaterial, outlineMaterial, tileMaterial, waterMaterial, skyMaterial, particleMaterial, FinalShader, sharedMaterials,
} from './shaders.js';
import { buildAvatar, setAvatarAge, buildCar, buildPeg, outlined } from './avatar.js';

const STEP = 3.3;
const ROW = 62;
const R = 7;
const TILE_Y = 0.32;

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
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function curvePoint(s) {
  const per = ROW + Math.PI * R;
  const k = Math.floor(s / per);
  const u = s - k * per;
  const dir = k % 2 === 0 ? 1 : -1;
  const z0 = k * 2 * R;
  const xStart = dir === 1 ? -ROW / 2 : ROW / 2;
  if (u < ROW) {
    return new THREE.Vector3(xStart + dir * u, 0, z0 + Math.sin((u / ROW) * Math.PI * 2) * 1.8);
  }
  const a = (u - ROW) / R;
  const cx = xStart + dir * ROW;
  const cz = z0 + R;
  return new THREE.Vector3(cx + dir * Math.sin(a) * R, 0, cz - Math.cos(a) * R);
}

function sdRoundBox(px, pz, hx, hz, r) {
  const qx = Math.abs(px) - hx + r;
  const qz = Math.abs(pz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

function makeIconAtlas() {
  const cell = 128;
  const grid = 4;
  const c = document.createElement('canvas');
  c.width = c.height = cell * grid;
  const g = c.getContext('2d');
  const types = Object.keys(TILE_INFO);
  const white = '#ffffff';
  const draw = {
    start(x, y) { g.fillStyle = white; g.font = 'bold 34px sans-serif'; g.fillText('START', x, y); },
    event(x, y) { g.fillStyle = white; g.font = 'bold 84px sans-serif'; g.fillText('!', x, y + 4); },
    lucky(x, y) { star(x, y, 40, 17, white); },
    payday(x, y) {
      g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(x, y, 38, 0, Math.PI * 2); g.fill();
      g.lineWidth = 6; g.strokeStyle = '#e8a400'; g.stroke();
      g.fillStyle = '#c77d00'; g.font = 'bold 40px sans-serif'; g.fillText('₩', x, y + 2);
    },
    love(x, y) { heart(x, y, 36, white); },
    hiyari(x, y) {
      g.fillStyle = white; g.beginPath();
      g.moveTo(x + 8, y - 44); g.lineTo(x - 22, y + 6); g.lineTo(x - 2, y + 6); g.lineTo(x - 10, y + 44);
      g.lineTo(x + 24, y - 8); g.lineTo(x + 4, y - 8); g.closePath(); g.fill();
    },
    choice(x, y) { g.fillStyle = white; g.font = 'bold 80px sans-serif'; g.fillText('?', x, y + 4); },
    card(x, y) {
      g.save(); g.translate(x, y); g.rotate(-0.2);
      g.fillStyle = white; roundRect(-24, -34, 48, 68, 8); g.fill();
      g.fillStyle = '#ff922b'; star(0, 0, 16, 7, '#ff922b');
      g.restore();
    },
    challenge(x, y) {
      g.fillStyle = white; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 34, y + 4); g.lineTo(x + 14, y + 4);
      g.lineTo(x + 14, y + 38); g.lineTo(x - 14, y + 38); g.lineTo(x - 14, y + 4); g.lineTo(x - 34, y + 4); g.closePath(); g.fill();
    },
    baby(x, y) {
      g.fillStyle = white; g.beginPath(); g.arc(x, y - 6, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f783ac'; g.beginPath(); g.arc(x - 9, y - 8, 4, 0, 7); g.arc(x + 9, y - 8, 4, 0, 7); g.fill();
      g.fillStyle = white; g.beginPath(); g.arc(x, y + 30, 14, 0, Math.PI * 2); g.fill();
    },
    stop(x, y) {
      g.fillStyle = white; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(x + Math.cos(a) * 46, y + Math.sin(a) * 46); }
      g.closePath(); g.fill();
      g.fillStyle = '#e03131'; g.font = 'bold 30px sans-serif'; g.fillText('STOP', x, y + 2);
    },
    end(x, y) {
      g.fillStyle = '#555'; g.beginPath(); g.moveTo(x - 26, y - 34); g.lineTo(x + 34, y); g.lineTo(x - 26, y + 34); g.closePath(); g.fill();
    },
    goal(x, y) { g.fillStyle = '#b8860b'; g.font = 'bold 40px sans-serif'; g.fillText('GOAL', x, y + 2); },
  };
  function roundRect(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function star(x, y, ro, ri, col) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? ri : ro; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  function heart(x, y, s, col) {
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
    g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  types.forEach((t, i) => {
    const cx = (i % grid) * cell + cell / 2;
    const cy = Math.floor(i / grid) * cell + cell / 2;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.25)';
    g.shadowOffsetY = 4;
    if (draw[t]) draw[t](cx, cy);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, grid: new THREE.Vector2(grid, grid), index: (t) => types.indexOf(t) };
}

function textSprite(text, { color = '#fff', bg = 'rgba(40,30,70,0.85)', size = 64, scale = 1 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${size}px sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size;
  c.width = w;
  c.height = size * 1.6;
  g.font = `bold ${size}px sans-serif`;
  g.fillStyle = bg;
  const r = size * 0.5;
  g.beginPath();
  g.moveTo(r, 0); g.arcTo(w, 0, w, c.height, r); g.arcTo(w, c.height, 0, c.height, r); g.arcTo(0, c.height, 0, 0, r); g.arcTo(0, 0, w, 0, r);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set((w / c.height) * 1.6 * scale, 1.6 * scale, 1);
  return sp;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
    this.clock = new THREE.Clock();
    this.tweens = [];
    this.pieces = new Map();
    this.camTarget = new THREE.Vector3();
    this.camGoal = new THREE.Vector3();
    this.orbit = { az: -0.35, pol: 0.95, dist: 30, distGoal: 30 };
    this.follow = null;

    this.buildLights();
    this.buildSky();
    this.buildBoard();
    this.buildTerrain();
    this.buildWater();
    this.buildDecor();
    this.buildParticles();
    this.buildComposer();
    this.bindControls();

    const mid = this.tilePos[Math.floor(this.tilePos.length / 2)];
    this.camTarget.copy(this.tilePos[0]);
    this.camGoal.copy(this.tilePos[0]);
    this.overviewPoint = new THREE.Vector3(0, 0, this.islandCenter.y);
    void mid;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------- 구성 ----------
  buildLights() {
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    this.sunDir = new THREE.Vector3(0.45, 0.85, 0.35).normalize();
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  buildSky() {
    this.skyMat = skyMaterial();
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat);
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.sky = sky;
  }

  buildBoard() {
    const n = BOARD.tiles.length;
    this.tilePos = [];
    this.tileHeading = [];
    for (let i = 0; i < n; i++) {
      const s = i * STEP;
      const p = curvePoint(s);
      const q = curvePoint(s + 0.5);
      this.tilePos.push(new THREE.Vector3(p.x, TILE_Y, p.z));
      this.tileHeading.push(Math.atan2(q.x - p.x, q.z - p.z));
    }
    // 도로 리본
    const pts = [];
    for (let s = -2; s <= (n - 1) * STEP + 2; s += 0.8) pts.push(curvePoint(s));
    const pos = [];
    const idx = [];
    const width = 2.3;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x);
      pos.push(pts[i].x + nrm.x * width, 0.08, pts[i].z + nrm.z * width, pts[i].x - nrm.x * width, 0.08, pts[i].z - nrm.z * width);
      if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, toonMaterial(0xe6cf9f, { rim: 0.05, specular: 0 }));
    road.receiveShadow = true;
    this.scene.add(road);

    // 칸 (인스턴싱)
    const shape = new THREE.Shape();
    const h = 1.35;
    const r = 0.45;
    shape.moveTo(-h + r, -h); shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r); shape.lineTo(h, h - r);
    shape.quadraticCurveTo(h, h, h - r, h); shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
    shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    const tg = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 6 });
    tg.rotateX(-Math.PI / 2);
    this.atlas = makeIconAtlas();
    this.tileMat = tileMaterial(this.atlas.tex, this.atlas.grid);
    this.tileMat.uniforms.uTopY.value = 0.46;
    const aIcon = new Float32Array(n);
    const aIndex = new Float32Array(n);
    const aColor = new Float32Array(n * 3);
    const col = new THREE.Color();
    BOARD.tiles.forEach((t, i) => {
      aIcon[i] = this.atlas.index(t.type);
      aIndex[i] = i;
      col.set(t.type === 'start' ? ERAS[t.era].color : TILE_INFO[t.type].color);
      if (t.type === 'end' || t.type === 'goal') col.set(0xffffff);
      aColor.set([col.r, col.g, col.b], i * 3);
    });
    tg.setAttribute('aIcon', new THREE.InstancedBufferAttribute(aIcon, 1));
    tg.setAttribute('aIndex', new THREE.InstancedBufferAttribute(aIndex, 1));
    tg.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
    const tiles = new THREE.InstancedMesh(tg, this.tileMat, n);
    const m = new THREE.Matrix4();
    const qn = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      qn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.tileHeading[i]);
      const big = BOARD.tiles[i].type === 'stop' || BOARD.tiles[i].type === 'goal' ? 1.2 : 1;
      m.compose(new THREE.Vector3(this.tilePos[i].x, 0.02, this.tilePos[i].z), qn, one.clone().multiplyScalar(big));
      tiles.setMatrixAt(i, m);
    }
    tiles.castShadow = false;
    tiles.receiveShadow = true;
    tiles.frustumCulled = false;
    this.scene.add(tiles);
    this.tiles = tiles;

    // 시대 표지판 + 아치
    const archM = toonMaterial(0xffffff);
    ERAS.forEach((era, ei) => {
      const i0 = BOARD.eraStart[ei];
      const p = this.tilePos[i0];
      const hd = this.tileHeading[i0];
      const arch = new THREE.Group();
      const pillarG = new THREE.CylinderGeometry(0.22, 0.26, 4.2, 12);
      const colM = toonMaterial(era.color);
      for (const sx of [-1, 1]) {
        const pl = outlined(arch, pillarG, colM);
        pl.position.set(sx * 2.4, 2.1, 0);
      }
      const beam = outlined(arch, new THREE.BoxGeometry(5.6, 0.7, 0.5), archM);
      beam.position.y = 4.3;
      const label = textSprite(era.name, { bg: '#' + new THREE.Color(era.color).getHexString(), color: '#2a2238', size: 56, scale: 0.9 });
      label.position.set(0, 5.6, 0);
      arch.add(label);
      arch.position.set(p.x, 0, p.z);
      arch.rotation.y = hd;
      this.scene.add(arch);
    });
    // STOP 칸 라벨
    BOARD.tiles.forEach((t, i) => {
      if (t.type !== 'stop') return;
      const txt = t.stop === 'marriage' ? '💒 결혼 STOP' : '🏠 내 집 마련 STOP';
      const sp = textSprite(txt, { bg: '#e03131', size: 44, scale: 0.9 });
      sp.position.copy(this.tilePos[i]).add(new THREE.Vector3(0, 3.2, 0));
      this.scene.add(sp);
    });
    // GOAL 아치
    const gi = n - 1;
    const gp = this.tilePos[gi];
    const goal = new THREE.Group();
    const gold = toonMaterial(0xffd43b, { specular: 0.8, rim: 0.6 });
    for (const sx of [-1, 1]) {
      const pl = outlined(goal, new THREE.CylinderGeometry(0.35, 0.4, 6, 14), gold);
      pl.position.set(sx * 3, 3, 0);
    }
    const tor = outlined(goal, new THREE.TorusGeometry(3, 0.35, 10, 32, Math.PI), gold);
    tor.position.y = 6;
    const gl = textSprite('GOAL!', { bg: '#ffd43b', color: '#8a4b00', size: 72, scale: 1.8 });
    gl.position.set(0, 10, 0);
    goal.add(gl);
    goal.position.set(gp.x, 0, gp.z);
    goal.rotation.y = this.tileHeading[gi];
    this.scene.add(goal);
  }

  buildTerrain() {
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (const p of this.tilePos) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const hx = (maxX - minX) / 2 + 16;
    const hz = (maxZ - minZ) / 2 + 16;
    this.islandCenter = new THREE.Vector2(cx, cz);
    this.islandHalf = new THREE.Vector2(hx, hz);
    this.islandRadius = 22;
    const W = hx * 2 + 70;
    const H = hz * 2 + 70;
    const geo = new THREE.PlaneGeometry(W, H, Math.round(W / 1.1), Math.round(H / 1.1));
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0, cz);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const rng = mulberry(7);
    const noiseTbl = Array.from({ length: 256 }, () => rng());
    const vnoise = (x, z) => {
      const xi = Math.floor(x); const zi = Math.floor(z);
      const xf = x - xi; const zf = z - zi;
      const h = (a, b) => noiseTbl[(a * 57 + b * 131) & 255];
      const u = xf * xf * (3 - 2 * xf); const v = zf * zf * (3 - 2 * zf);
      return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
    };
    this.pathDist = (x, z) => {
      let best = Infinity; let bi = 0;
      for (let i = 0; i < this.tilePos.length; i += 1) {
        const p = this.tilePos[i];
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < best) { best = d; bi = i; }
      }
      return [Math.sqrt(best), bi];
    };
    const sand = new THREE.Color(0xf4e2a8);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const d = sdRoundBox(x - cx, z - cz, hx, hz, this.islandRadius);
      const [pd, ti] = this.pathDist(x, z);
      let y;
      if (d > 0) y = -0.5 - Math.min(d * 0.25, 6);
      else {
        const inland = Math.min(1, -d / 6);
        const hill = (vnoise(x * 0.08, z * 0.08) * 0.7 + vnoise(x * 0.2, z * 0.2) * 0.3);
        const away = Math.min(1, Math.max(0, (pd - 4.5) / 7));
        y = inland * 0.02 + Math.pow(hill, 2) * 7 * away * Math.min(1, -d / 14);
      }
      pos.setY(i, y);
      c.set(ERAS[BOARD.tiles[ti].era].ground);
      const tint = 0.9 + vnoise(x * 0.3, z * 0.3) * 0.2;
      c.multiplyScalar(tint);
      if (y > 2.5) c.lerp(new THREE.Color(0x6e9e55), Math.min(1, (y - 2.5) / 4));
      const beach = 1 - Math.min(1, Math.max(0, (-d - 1) / 4));
      c.lerp(sand, beach);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, toonMaterial(0xffffff, { vertexColors: true, grass: 1, rim: 0.05, specular: 0 }));
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.terrainHeight = (x, z) => {
      // 대략적인 높이 (장식 배치용): 가장 가까운 정점 탐색 대신 동일 공식 사용
      const d = sdRoundBox(x - cx, z - cz, hx, hz, this.islandRadius);
      if (d > 0) return -1;
      const [pd] = this.pathDist(x, z);
      const hill = (vnoise(x * 0.08, z * 0.08) * 0.7 + vnoise(x * 0.2, z * 0.2) * 0.3);
      const away = Math.min(1, Math.max(0, (pd - 4.5) / 7));
      return Math.pow(hill, 2) * 7 * away * Math.min(1, -d / 14);
    };
  }

  buildWater() {
    this.waterMat = waterMaterial();
    this.waterMat.uniforms.uIslandCenter.value.copy(this.islandCenter);
    this.waterMat.uniforms.uIslandHalf.value.copy(this.islandHalf);
    this.waterMat.uniforms.uIslandRadius.value = this.islandRadius;
    this.waterMat.uniforms.uSunDir.value.copy(this.sunDir);
    const g = new THREE.PlaneGeometry(900, 900, 220, 220);
    g.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(g, this.waterMat);
    water.position.set(this.islandCenter.x, -1.1, this.islandCenter.y);
    this.scene.add(water);
  }

  buildDecor() {
    const rng = mulberry(99);
    const trunks = []; const leaves = []; const pines = []; const houses = []; const roofs = []; const towers = []; const toys = [];
    const hx = this.islandHalf.x; const hz = this.islandHalf.y;
    for (let k = 0; k < 900; k++) {
      const x = this.islandCenter.x + (rng() * 2 - 1) * hx;
      const z = this.islandCenter.y + (rng() * 2 - 1) * hz;
      const d = sdRoundBox(x - this.islandCenter.x, z - this.islandCenter.y, hx, hz, this.islandRadius);
      if (d > -5) continue;
      const [pd, ti] = this.pathDist(x, z);
      if (pd < 5.2) continue;
      const y = this.terrainHeight(x, z);
      const era = ERAS[BOARD.tiles[ti].era].id;
      const r = rng();
      const s = 0.7 + rng() * 0.7;
      if (pd < 9 && r < 0.45) {
        if (era === 'baby') toys.push({ x, y, z, s, rot: rng() * 6, c: [0xff8787, 0x74c0fc, 0xffe066, 0x8ce99a][Math.floor(rng() * 4)] });
        else if (era === 'adult1' || era === 'adult2') {
          if (rng() < 0.5 && pd > 8) towers.push({ x, y, z, s: s * 0.8, h: 2.5 + rng() * 4.5, rot: rng() * 6, c: [0xdee2e6, 0xa5d8ff, 0xffd8a8, 0xd0bfff][Math.floor(rng() * 4)] });
          else houses.push({ x, y, z, s, rot: rng() * 6, c: [0xfff5e6, 0xffe3e3, 0xe7f5ff][Math.floor(rng() * 3)], roof: [0xe8590c, 0x1971c2, 0x2f9e44][Math.floor(rng() * 3)] });
        } else houses.push({ x, y, z, s, rot: rng() * 6, c: [0xfff5e6, 0xffe3e3, 0xe7f5ff, 0xfff9db][Math.floor(rng() * 4)], roof: [0xe8590c, 0x1971c2, 0x2f9e44, 0xc2255c][Math.floor(rng() * 4)] });
      } else if (rng() < 0.5) {
        trunks.push({ x, y, z, s }); leaves.push({ x, y, z, s, c: [0x69db7c, 0x8ce99a, 0x51cf66, 0xa9e34b][Math.floor(rng() * 4)] });
      } else pines.push({ x, y, z, s, c: [0x2f9e44, 0x37b24d, 0x40c057][Math.floor(rng() * 3)] });
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const inst = (geo, list, mat, place, outline = true) => {
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
      this.scene.add(im);
      if (outline) {
        const ol = new THREE.InstancedMesh(geo, (this._olMat ||= outlineMaterial(0x2a2238, 0.04)), list.length);
        ol.instanceMatrix = im.instanceMatrix;
        this.scene.add(ol);
      }
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const trunkG = new THREE.CylinderGeometry(0.18, 0.26, 1.4, 7); trunkG.translate(0, 0.7, 0);
    const leafG = new THREE.IcosahedronGeometry(1.1, 1); leafG.translate(0, 2.1, 0);
    const pineG = new THREE.ConeGeometry(1.0, 3.2, 8); pineG.translate(0, 1.9, 0);
    const houseG = new THREE.BoxGeometry(2, 1.6, 2); houseG.translate(0, 0.8, 0);
    const roofG = new THREE.ConeGeometry(1.75, 1.3, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 2.25, 0);
    const towerG = new THREE.BoxGeometry(2.2, 1, 2.2); towerG.translate(0, 0.5, 0);
    const toyG = new THREE.BoxGeometry(1.3, 1.3, 1.3); toyG.translate(0, 0.65, 0);
    const white = toonMaterial(0xffffff);
    inst(trunkG, trunks, toonMaterial(0x8d5a3b), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s, o.s), null]);
    inst(leafG, leaves, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s, o.s), o.c]);
    inst(pineG, pines, toonMaterial(0xffffff, { rim: 0.4 }), (o) => [V(o.x, o.y, o.z), 0, V(o.s, o.s * 1.1, o.s), o.c]);
    inst(houseG, houses, white, (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.c]);
    inst(roofG, houses, toonMaterial(0xffffff, { specular: 0.4 }), (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.roof]);
    inst(towerG, towers, toonMaterial(0xffffff, { specular: 0.6, rim: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.h, o.s), o.c]);
    inst(toyG, toys, toonMaterial(0xffffff, { specular: 0.5 }), (o) => [V(o.x, o.y, o.z), o.rot, V(o.s, o.s, o.s), o.c]);
  }

  buildParticles() {
    const N = 260;
    const g = new THREE.BufferGeometry();
    const vel = new Float32Array(N * 3);
    const colr = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const pal = [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8, 0xff922b].map((h) => new THREE.Color(h));
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      vel.set([Math.cos(a) * sp, 7 + Math.random() * 8, Math.sin(a) * sp], i * 3);
      const c = pal[i % pal.length];
      colr.set([c.r, c.g, c.b], i * 3);
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colr, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.particleMat = particleMaterial();
    const pts = new THREE.Points(g, this.particleMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.45, 0.93);
    this.composer.addPass(this.bloom);
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);
    this.composer.addPass(new OutputPass());
  }

  bindControls() {
    let drag = null;
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: this.orbit.az, pol: this.orbit.pol }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.orbit.az = drag.az - (e.clientX - drag.x) * 0.006;
      this.orbit.pol = Math.max(0.35, Math.min(1.35, drag.pol - (e.clientY - drag.y) * 0.005));
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.distGoal = Math.max(10, Math.min(140, this.orbit.distGoal * (1 + Math.sign(e.deltaY) * 0.12)));
    }, { passive: false });
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.finalPass.uniforms.uResolution.value.set(w * pr, h * pr);
  }

  // ---------- 말 ----------
  ensurePiece(p, index) {
    let pc = this.pieces.get(p.id);
    if (pc) return pc;
    const root = new THREE.Group();
    const fig = buildAvatar(p.avatar);
    root.add(fig);
    const car = buildCar(p.avatar.shirt || '#ff6b6b');
    car.visible = false;
    root.add(car);
    const pegs = new THREE.Group();
    root.add(pegs);
    const name = textSprite(p.name, { bg: p.avatar.shirt || '#555', size: 40, scale: 0.7 });
    name.position.y = 3.1;
    root.add(name);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 32), new THREE.MeshBasicMaterial({ color: p.avatar.shirt || '#fff', transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.55;
    root.add(ring);
    this.scene.add(root);
    pc = { root, fig, car, pegs, name, ring, index, tile: p.tile, era: -1, kids: -1, married: null, hop: 0 };
    this.pieces.set(p.id, pc);
    root.position.copy(this.slotPos(p.tile, index));
    root.rotation.y = this.tileHeading[p.tile];
    return pc;
  }

  slotPos(tile, index) {
    const base = this.tilePos[tile].clone();
    const hd = this.tileHeading[tile];
    const offs = [[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.6], [0.65, 0.6]][index % 4];
    const c = Math.cos(hd); const s = Math.sin(hd);
    base.x += offs[0] * c + offs[1] * s;
    base.z += -offs[0] * s + offs[1] * c;
    base.y = TILE_Y + 0.12;
    return base;
  }

  syncPieces(state, animating) {
    state.players.forEach((p, i) => {
      const pc = this.ensurePiece(p, i);
      if (!animating) {
        pc.tile = p.tile;
        pc.root.position.copy(this.slotPos(p.tile, i));
        pc.root.rotation.y = this.tileHeading[p.tile];
      }
      if (pc.era !== state.era) {
        pc.era = state.era;
        setAvatarAge(pc.fig, state.era);
        const adult = state.era >= 4;
        pc.car.visible = adult;
        pc.fig.position.set(0, adult ? 0.45 : 0, adult ? -0.15 : 0);
        pc.name.position.y = adult ? 3.3 : 1.2 + 1.9 * pc.fig.scale.x;
      }
      const kidsKey = p.kids.length + (p.spouse ? 100 : 0);
      if (pc.kids !== kidsKey) {
        pc.kids = kidsKey;
        pc.pegs.clear();
        const spots = [[0.3, 0.65, 0.35], [-0.3, 0.65, -0.45], [0.3, 0.65, -0.45], [-0.3, 0.65, 0.35], [0, 0.65, -0.1]];
        let k = 0;
        if (p.spouse) {
          const sp = buildPeg(0xff8fab);
          sp.position.set(...spots[k++]);
          pc.pegs.add(sp);
        }
        p.kids.forEach((_, j) => {
          if (k >= spots.length) return;
          const kp = buildPeg([0x74c0fc, 0xffd43b, 0x8ce99a, 0xcc5de8][j % 4], true);
          kp.position.set(...spots[k++]);
          pc.pegs.add(kp);
        });
        pc.pegs.visible = state.era >= 4;
      }
      pc.pegs.visible = state.era >= 4;
      pc.ring.visible = state.pending && state.pending.playerId === p.id;
    });
  }

  tween(duration, fn) {
    return new Promise((resolve) => {
      this.tweens.push({ t0: this.clock.elapsedTime, duration: duration / 1000, fn, resolve });
    });
  }

  async hopPath(pid, path, index, onStep) {
    const pc = this.pieces.get(pid);
    if (!pc) return;
    for (const ti of path) {
      const from = pc.root.position.clone();
      const to = this.slotPos(ti, index);
      const h0 = pc.root.rotation.y;
      let h1 = this.tileHeading[ti];
      while (h1 - h0 > Math.PI) h1 -= Math.PI * 2;
      while (h1 - h0 < -Math.PI) h1 += Math.PI * 2;
      await this.tween(260, (t) => {
        pc.root.position.lerpVectors(from, to, t);
        pc.root.position.y = to.y + Math.sin(t * Math.PI) * 1.1;
        pc.root.rotation.y = h0 + (h1 - h0) * Math.min(1, t * 2);
        const sq = 1 + Math.sin(t * Math.PI) * 0.12;
        pc.fig.scale.y = pc.fig.scale.x * sq;
      });
      pc.fig.scale.y = pc.fig.scale.x;
      pc.tile = ti;
      if (onStep) onStep(ti);
    }
  }

  async warp(pid, tile, index) {
    const pc = this.pieces.get(pid);
    if (!pc) return;
    const from = pc.root.position.clone();
    const to = this.slotPos(tile, index);
    await this.tween(900, (t) => {
      const e = easeInOut(t);
      pc.root.position.lerpVectors(from, to, e);
      pc.root.position.y = to.y + Math.sin(t * Math.PI) * 6;
      pc.root.rotation.y += 0.25;
    });
    pc.root.rotation.y = this.tileHeading[tile];
    pc.tile = tile;
  }

  focus(pid, instant = false) {
    this.follow = pid;
    if (instant) {
      const pc = this.pieces.get(pid);
      if (pc) this.camTarget.copy(pc.root.position);
    }
  }
  focusTile(i) { this.follow = null; this.camGoal.copy(this.tilePos[i]); }
  overview() {
    this.follow = null;
    this.camGoal.set(this.islandCenter.x, 0, this.islandCenter.y);
    this.orbit.distGoal = 150;
  }
  zoomDefault() { this.orbit.distGoal = 30; }

  setActiveTile(i) { this.tileMat.uniforms.uActive.value = i; }

  confetti(pos) {
    this.particleMat.uniforms.uOrigin.value.copy(pos).add(new THREE.Vector3(0, 2, 0));
    this.particleMat.uniforms.uStart.value = this.clock.elapsedTime;
  }
  confettiAt(pid) {
    const pc = this.pieces.get(pid);
    if (pc) this.confetti(pc.root.position);
  }
  flash(amount = 0.6) { this.flashV = amount; }

  project(pid, yOff = 2.5) {
    const pc = this.pieces.get(pid);
    if (!pc) return null;
    const v = pc.root.position.clone();
    v.y += yOff;
    v.project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  // ---------- 프레임 ----------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    // 트윈
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const t = Math.min(1, (time - tw.t0) / tw.duration);
      tw.fn(t);
      if (t >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
    // 카메라
    if (this.follow) {
      const pc = this.pieces.get(this.follow);
      if (pc) this.camGoal.copy(pc.root.position).setY(0);
    }
    const k = 1 - Math.pow(0.02, dt);
    this.camTarget.lerp(this.camGoal, k);
    this.orbit.dist += (this.orbit.distGoal - this.orbit.dist) * k;
    const { az, pol, dist } = this.orbit;
    this.camera.position.set(
      this.camTarget.x + Math.sin(az) * Math.sin(pol) * dist,
      this.camTarget.y + Math.cos(pol) * dist,
      this.camTarget.z - Math.cos(az) * Math.sin(pol) * dist,
    );
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 1, this.camTarget.z);
    // 태양/그림자 카메라가 시점을 따라다님
    this.sun.position.copy(this.camTarget).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(this.camTarget);
    const sc = this.sun.shadow.camera;
    const ext = Math.max(30, dist * 0.9);
    if (Math.abs(sc.right - ext) > 1) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    this.sky.position.copy(this.camera.position);
    // 유니폼
    for (const m of sharedMaterials) if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    this.waterMat.uniforms.uTime.value = time;
    this.skyMat.uniforms.uTime.value = time;
    this.particleMat.uniforms.uTime.value = time;
    for (const pc of this.pieces.values()) {
      if (pc.ring.visible) { pc.ring.rotation.z += dt * 1.5; pc.ring.material.opacity = 0.6 + 0.3 * Math.sin(time * 5); }
      pc.fig.userData.head.rotation.z = Math.sin(time * 2 + pc.index) * 0.05;
    }
    this.finalPass.uniforms.uBlur.value = Math.min(2.2, 0.6 + dist / 40);
    if (this.flashV > 0) { this.flashV = Math.max(0, this.flashV - dt * 1.5); }
    this.finalPass.uniforms.uFlash.value = this.flashV || 0;
    this.composer.render(dt);
  }
}
