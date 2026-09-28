/**
 * @pyramid-spec      design/view/board-view/board-view.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/board-view/board-view.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import type { Stage } from '../stage/stage';
import { makeIconAtlas } from './atlas/atlas';
import { buildBoardMesh, type BoardView } from './board-mesh/board-mesh';

export type { BoardView } from './board-mesh/board-mesh';
export { TILE_Y } from './board-mesh/board-mesh';

export function buildBoardView(stage: Stage): BoardView {
  return buildBoardMesh(stage, makeIconAtlas());
}
