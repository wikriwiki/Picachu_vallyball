/**
 * @pyramid-spec      design/view/board-view/atlas/atlas.md
 * @pyramid-parent    design/view/board-view/board-view.md
 * @pyramid-on-change 1) design/view/board-view/atlas/atlas.md 먼저 수정 2) 이 코드 수정 3) design/view/board-view/board-view.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { TILE_TYPES, type TileType } from '../../../data/data';
import { canvasTexture } from '../../toolkit/toolkit';

export const ATLAS_CELL = 128;
export const ATLAS_GRID = 6;
export function atlasCell(i: number): { cx: number; cy: number } {
  return { cx: (i % ATLAS_GRID) * ATLAS_CELL + ATLAS_CELL / 2, cy: Math.floor(i / ATLAS_GRID) * ATLAS_CELL + ATLAS_CELL / 2 };
}

type G = CanvasRenderingContext2D;
function roundRect(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function star(g: G, x: number, y: number, ro: number, ri: number, col: string, stroke?: string) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? ri : ro; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath();
  if (stroke) { g.lineWidth = 6; g.lineJoin = 'round'; g.strokeStyle = stroke; g.stroke(); }
  g.fill();
}
function heart(g: G, x: number, y: number, s: number, col: string) {
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9);
  g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); g.fill();
}
const text = (g: G, t: string, x: number, y: number, font: string, col: string) => { g.fillStyle = col; g.font = font; g.fillText(t, x, y); };

const DRAW: Partial<Record<TileType, (g: G, x: number, y: number) => void>> = {
  start: (g, x, y) => text(g, 'START', x, y, 'bold 34px sans-serif', '#2a2238'),
  star1: (g, x, y) => star(g, x, y, 36, 15, '#ffc21a', '#ffffff'),
  star2: (g, x, y) => { star(g, x - 20, y + 10, 26, 11, '#fff3a0', '#b35400'); star(g, x + 22, y - 14, 22, 9, '#fff3a0', '#b35400'); star(g, x + 16, y + 26, 12, 5, '#fff3a0'); },
  star3: (g, x, y) => {
    g.save(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * 44, y + Math.sin(a) * 44); g.lineTo(x + Math.cos(a) * 58, y + Math.sin(a) * 58); g.stroke(); }
    g.restore();
    star(g, x, y, 42, 18, '#ffffff', '#ff9d00'); star(g, x + 34, y - 34, 9, 3, '#ffffff'); star(g, x - 36, y + 30, 7, 3, '#ffffff');
  },
  payday: (g, x, y) => {
    g.fillStyle = '#fff3a8'; g.beginPath(); g.arc(x, y, 38, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#e8a400'; g.stroke();
    text(g, '₩', x, y + 2, 'bold 40px sans-serif', '#c77d00');
  },
  love: (g, x, y) => heart(g, x, y, 36, '#ffffff'),
  hiyari: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y - 44);
    g.bezierCurveTo(x + 10, y - 22, x + 34, y - 2, x + 34, y + 16);
    g.arc(x, y + 16, 34, 0, Math.PI, false);
    g.bezierCurveTo(x - 34, y - 2, x - 10, y - 22, x, y - 44); g.fill();
    g.fillStyle = '#7cc7ff'; g.beginPath(); g.ellipse(x - 13, y + 12, 7, 12, -0.4, 0, Math.PI * 2); g.fill();
  },
  ghost: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y - 6, 32, Math.PI, 0); g.lineTo(x + 32, y + 36);
    for (let i = 0; i < 4; i++) { const x0 = x + 32 - i * 16; g.quadraticCurveTo(x0 - 8, y + 22, x0 - 16, y + 36); }
    g.closePath(); g.fill();
    g.fillStyle = '#2a2238'; g.beginPath(); g.ellipse(x - 11, y - 6, 5, 8, 0, 0, 7); g.ellipse(x + 11, y - 6, 5, 8, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y + 12, 7, 5, 0, 0, 7); g.fill();
  },
  choice: (g, x, y) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 11; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y + 40); g.lineTo(x, y + 4); g.lineTo(x - 26, y - 22); g.moveTo(x, y + 4); g.lineTo(x + 26, y - 22); g.stroke();
    g.fillStyle = '#ffffff';
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + sx * 38, y - 36); g.lineTo(x + sx * 14, y - 32); g.lineTo(x + sx * 34, y - 12); g.closePath(); g.fill(); }
  },
  card: (g, x, y) => { g.save(); g.translate(x, y); g.rotate(-0.2); g.fillStyle = '#ffffff'; roundRect(g, -24, -34, 48, 68, 8); g.fill(); star(g, 0, 0, 16, 7, '#5c9dff'); g.restore(); },
  challenge: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 34, y + 4); g.lineTo(x + 14, y + 4);
    g.lineTo(x + 14, y + 38); g.lineTo(x - 14, y + 38); g.lineTo(x - 14, y + 4); g.lineTo(x - 34, y + 4); g.closePath(); g.fill();
  },
  baby: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y - 6, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f783ac'; g.beginPath(); g.arc(x - 9, y - 8, 4, 0, 7); g.arc(x + 9, y - 8, 4, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y + 30, 14, 0, Math.PI * 2); g.fill();
  },
  stop: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(x + Math.cos(a) * 46, y + Math.sin(a) * 46); }
    g.closePath(); g.fill();
    text(g, 'STOP', x, y + 2, 'bold 30px sans-serif', '#e03131');
  },
  end: (g, x, y) => { g.fillStyle = '#555'; g.beginPath(); g.moveTo(x - 26, y - 34); g.lineTo(x + 34, y); g.lineTo(x - 26, y + 34); g.closePath(); g.fill(); },
  goal: (g, x, y) => text(g, 'GOAL', x, y + 2, 'bold 40px sans-serif', '#b8860b'),
  destiny: (g, x, y) => { heart(g, x, y, 38, '#ffffff'); star(g, x + 30, y - 30, 10, 4, '#ffffff'); star(g, x - 32, y + 26, 7, 3, '#ffffff'); },
  travel: (g, x, y) => {
    g.save(); g.translate(x, y); g.rotate(-0.6); g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(0, 0, 44, 9, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(14, -34); g.lineTo(22, -34); g.lineTo(12, 0); g.lineTo(22, 34); g.lineTo(14, 34); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-34, 0); g.lineTo(-40, -16); g.lineTo(-34, -16); g.lineTo(-26, 0); g.lineTo(-34, 16); g.lineTo(-40, 16); g.closePath(); g.fill();
    g.restore();
  },
  substart: (g, x, y) => text(g, 'WELCOME', x, y, 'bold 30px sans-serif', '#2a2238'),
  rest: (g, x, y) => text(g, 'Zz', x, y + 4, 'bold 64px sans-serif', '#ffffff'),
  farm: (g, x, y) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x, y + 40); g.lineTo(x - 16, y - 10); g.quadraticCurveTo(x, y - 22, x + 16, y - 10); g.closePath(); g.fill();
    g.fillStyle = '#2f9e44'; for (const dx of [-10, 0, 10]) { g.beginPath(); g.ellipse(x + dx, y - 26, 5, 14, dx * 0.03, 0, 7); g.fill(); }
  },
  bet: (g, x, y) => {
    g.fillStyle = '#ffffff'; roundRect(g, x - 34, y - 34, 68, 68, 12); g.fill();
    g.fillStyle = '#f03e3e'; for (const [dx, dy] of [[-16, -16], [16, 16], [0, 0], [16, -16], [-16, 16]]) { g.beginPath(); g.arc(x + dx, y + dy, 7, 0, 7); g.fill(); }
  },
  dig: (g, x, y) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 30, y + 34); g.lineTo(x + 20, y - 18); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 8, y - 36); g.lineTo(x + 40, y - 30); g.lineTo(x + 34, y - 4); g.closePath(); g.fill();
  },
  jackpot: (g, x, y) => text(g, '777', x, y + 4, 'bold 60px sans-serif', '#ffffff'),
  pray: (g, x, y) => {
    g.fillStyle = '#ffffff';
    g.fillRect(x - 46, y - 34, 92, 10); g.fillRect(x - 38, y - 18, 76, 8); g.fillRect(x - 30, y - 30, 10, 70); g.fillRect(x + 20, y - 30, 10, 70);
  },
  omikuji: (g, x, y) => { g.fillStyle = '#e64980'; roundRect(g, x - 22, y - 40, 44, 80, 8); g.fill(); text(g, '吉', x, y + 2, 'bold 34px sans-serif', '#ffffff'); },
  return: (g, x, y) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, 30, Math.PI * 0.2, Math.PI * 1.7); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 36, y - 30); g.lineTo(x + 36, y + 2); g.lineTo(x + 8, y - 22); g.closePath(); g.fill();
  },
};

export function makeIconAtlas(): { texture: THREE.Texture; grid: THREE.Vector2; index(type: TileType): number } {
  const size = ATLAS_CELL * ATLAS_GRID;
  const texture = canvasTexture(size, size, (g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    TILE_TYPES.forEach((t, i) => {
      const { cx, cy } = atlasCell(i);
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowOffsetY = 4;
      DRAW[t]?.(g, cx, cy);
      g.restore();
    });
  });
  return { texture, grid: new THREE.Vector2(ATLAS_GRID, ATLAS_GRID), index: (t) => TILE_TYPES.indexOf(t) };
}
