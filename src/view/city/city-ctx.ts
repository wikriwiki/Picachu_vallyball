/**
 * @pyramid-spec      design/view/city/city.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/city/city.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import type * as THREE from 'three';
import type { Environment } from '../environment/environment';
import type { BoardView } from '../board-view/board-view';

export interface Rect { x0: number; x1: number; z0: number; z1: number; }
export interface CityCtx {
  scene: THREE.Scene;
  env: Environment;
  board: BoardView;
  rng: () => number;
  occupied: Rect[];
  updaters: ((t: number, dt: number) => void)[];
  rows: number;
  zMin: number;
  zMax: number;
  roadZs: number[];
  side: number;
  tileNear(r: Rect, margin?: number): boolean;
}
export const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
