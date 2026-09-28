/**
 * @pyramid-spec      design/view/toolkit/kit/kit.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/kit/kit.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { outlineMaterial } from '../toon/toon';

let sharedOutline: THREE.ShaderMaterial | null = null;
const defaultOutline = () => (sharedOutline ??= outlineMaterial(0x2a2238, 0.03));

export interface OutlineOptions { outline?: boolean; shadow?: boolean; thickness?: number; }

export function outlined(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, opts: OutlineOptions = {}): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.shadow ?? true;
  m.receiveShadow = true;
  parent.add(m);
  if (opts.outline ?? true) {
    const o = new THREE.Mesh(geometry, opts.thickness ? outlineMaterial(0x2a2238, opts.thickness) : defaultOutline());
    m.add(o);
  }
  return m;
}

function make2d(w: number, h: number): { canvas: HTMLCanvasElement | null; g: CanvasRenderingContext2D | null } {
  if (typeof document === 'undefined') return { canvas: null, g: null };
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  let g: CanvasRenderingContext2D | null = null;
  try { g = canvas.getContext('2d'); } catch { g = null; }
  return { canvas, g };
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture {
  const { canvas, g } = make2d(w, h);
  if (!canvas || !g) return new THREE.Texture();
  draw(g, w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textSprite(text: string, opts: { color?: string; bg?: string; size?: number; scale?: number } = {}): THREE.Sprite {
  const { color = '#fff', bg = 'rgba(40,30,70,0.85)', size = 64, scale = 1 } = opts;
  const probe = make2d(1, 1).g;
  let w = text.length * size;
  if (probe) { probe.font = `bold ${size}px sans-serif`; w = Math.ceil(probe.measureText(text).width) + size; }
  const h = size * 1.6;
  const tex = canvasTexture(w, h, (g) => {
    g.font = `bold ${size}px sans-serif`;
    g.fillStyle = bg;
    const r = size * 0.5;
    g.beginPath();
    g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r);
    g.fill();
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set((w / h) * 1.6 * scale, 1.6 * scale, 1);
  return sp;
}

export function box(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, opts: OutlineOptions = {}): THREE.Mesh {
  const m = outlined(parent, new THREE.BoxGeometry(w, h, d), mat, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}
export function cyl(parent: THREE.Object3D, rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16, opts: OutlineOptions = {}): THREE.Mesh {
  const m = outlined(parent, new THREE.CylinderGeometry(rt, rb, h, seg), mat, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}
export function cone(parent: THREE.Object3D, r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16, opts: OutlineOptions = {}): THREE.Mesh {
  const m = outlined(parent, new THREE.ConeGeometry(r, h, seg), mat, opts);
  m.position.set(x, y + h / 2, z);
  return m;
}
export function gable(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  const m = outlined(parent, g, mat);
  m.position.set(x, y, z);
  return m;
}

export function sdRoundBox(px: number, pz: number, hx: number, hz: number, r: number): number {
  const qx = Math.abs(px) - hx + r;
  const qz = Math.abs(pz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
