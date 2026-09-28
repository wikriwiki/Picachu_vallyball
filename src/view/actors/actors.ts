/**
 * @pyramid-spec      design/view/actors/actors.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/actors/actors.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import type * as THREE from 'three';
import type { PublicState } from '../../engine/engine';
import type { Stage } from '../stage/stage';
import type { BoardView } from '../board-view/board-view';
import { createPieces } from './pieces/pieces';
import { createConfetti } from './confetti/confetti';

export { createAvatarPreview, type AvatarPreview } from './preview/preview';

export interface Actors {
  syncPieces(state: PublicState, animating: boolean): void;
  hopPath(pid: string, path: number[], index: number, onStep?: (tile: number) => void): Promise<void>;
  warp(pid: string, tile: number, index: number, fly: boolean): Promise<void>;
  piecePos(pid: string): THREE.Vector3 | null;
  confettiAt(pid: string): void;
}

export function createActors(stage: Stage, board: BoardView): Actors {
  const pieces = createPieces(stage, board);
  const confetti = createConfetti(stage);
  return {
    syncPieces: (s, a) => pieces.sync(s, a),
    hopPath: (pid, path, index, onStep) => pieces.hopPath(pid, path, index, onStep),
    warp: (pid, tile, index, fly) => pieces.warp(pid, tile, index, fly),
    piecePos: (pid) => pieces.pos(pid),
    confettiAt: (pid) => { const p = pieces.pos(pid); if (p) confetti.burst(p); },
  };
}
