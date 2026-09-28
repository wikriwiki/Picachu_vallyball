/**
 * @pyramid-spec      design/view/city/city.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/city/city.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { BOARD, LAYOUT, createRng } from '../../data/data';
import type { Stage } from '../stage/stage';
import type { Environment } from '../environment/environment';
import type { BoardView } from '../board-view/board-view';
import type { CityCtx, Rect } from './city-ctx';
import { buildStreets } from './streets/streets';
import { placeLandmarks } from './landmarks/landmarks';
import { fillCity } from './fill/fill';
import { decorateIslands } from './islands/islands';

export interface City { update(time: number, dt: number): void; }

export function makeCityCtx(stage: Pick<Stage, 'scene'>, env: Environment, board: BoardView): CityCtx {
  const { RS, ROW } = LAYOUT;
  const main = BOARD.tiles.filter((t) => t.era >= 0);
  const rows = Math.round(Math.max(...main.map((t) => t.z)) / RS) + 1;
  const roadZs: number[] = [];
  for (let k = -1; k < rows; k++) roadZs.push(k * RS + RS / 2);
  return {
    scene: stage.scene, env, board, rng: createRng(4242), occupied: [], updaters: [],
    rows, roadZs, zMin: roadZs[0], zMax: roadZs[roadZs.length - 1], side: ROW / 2 + 8,
    tileNear: (r: Rect, m = 1.9) => main.some((t) => t.x > r.x0 - m && t.x < r.x1 + m && t.z > r.z0 - m && t.z < r.z1 + m),
  };
}

export function buildCity(stage: Stage, env: Environment, board: BoardView): City {
  const ctx = makeCityCtx(stage, env, board);
  const roadDist = buildStreets(ctx);
  placeLandmarks(ctx);
  fillCity(ctx, roadDist);
  decorateIslands(ctx);
  const city: City = { update(t, dt) { for (const u of ctx.updaters) u(t, dt); } };
  stage.onFrame((t, dt) => city.update(t, dt));
  return city;
}
