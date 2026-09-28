/**
 * @pyramid-spec      design/view/view.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/view/view.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import type { PublicState } from '../engine/engine';
import { createStage } from './stage/stage';
import { buildEnvironment } from './environment/environment';
import { buildBoardView } from './board-view/board-view';
import { buildCity } from './city/city';
import { createActors } from './actors/actors';
import { createRoulette, type RouletteView } from './roulette/roulette';

export { createAvatarPreview, type AvatarPreview } from './actors/actors';
export type { RouletteView } from './roulette/roulette';

export interface ScreenPoint { x: number; y: number; }
export interface ViewSounds { tick(): void; ding(): void; }
export interface View {
  syncPieces(state: PublicState, animating: boolean): void;
  hopPath(pid: string, path: number[], index: number, onStep?: (tile: number) => void): Promise<void>;
  warp(pid: string, tile: number, index: number, fly: boolean): Promise<void>;
  focus(pid: string, instant?: boolean): void;
  focusTile(tile: number): void;
  overview(): void;
  zoomDefault(): void;
  setActiveTile(tile: number): void;
  confettiAt(pid: string): void;
  flash(amount?: number): void;
  project(pid: string, yOffset?: number): ScreenPoint | null;
  readonly roulette: RouletteView;
}

export function createView(worldCanvas: HTMLCanvasElement, rouletteCanvas: HTMLCanvasElement, sounds?: ViewSounds): View {
  const stage = createStage(worldCanvas);
  const env = buildEnvironment(stage);
  const board = buildBoardView(stage);
  buildCity(stage, env, board);
  const actors = createActors(stage, board);
  const roulette = createRoulette(rouletteCanvas, sounds);
  stage.onFrame(() => stage.setBlur(Math.min(2.2, 0.6 + stage.orbit.dist / 40)));
  return {
    syncPieces: (s, a) => actors.syncPieces(s, a),
    hopPath: (pid, path, index, onStep) => actors.hopPath(pid, path, index, onStep),
    warp: (pid, tile, index, fly) => actors.warp(pid, tile, index, fly),
    focus(pid, instant = false) {
      stage.follow(() => actors.piecePos(pid));
      if (instant) { const p = actors.piecePos(pid); if (p) stage.target.set(p.x, 0, p.z); }
    },
    focusTile: (i) => stage.lookAt(board.tilePos[i]),
    overview() { stage.lookAt(new THREE.Vector3(env.island.cx, 0, env.island.cz)); stage.setDistance(210); },
    zoomDefault: () => stage.setDistance(30),
    setActiveTile: (i) => board.setActiveTile(i),
    confettiAt: (pid) => actors.confettiAt(pid),
    flash: (a = 0.6) => stage.flash(a),
    project(pid, y = 2.5) {
      const p = actors.piecePos(pid);
      if (!p) return null;
      return stage.project(p.clone().add(new THREE.Vector3(0, y, 0)));
    },
    roulette,
  };
}
