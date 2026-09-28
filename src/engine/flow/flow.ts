/**
 * @pyramid-spec      design/engine/flow/flow.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/flow/flow.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import type { Ctx } from '../core/core';
import { advance } from './turn/turn';
import { queueEraStart } from './era/era';

export * from './turn/turn';
export * from './era/era';
export * from './movement/movement';
export * from './finish/finish';

export function startGame(ctx: Ctx): void {
  queueEraStart(ctx);
  advance(ctx);
}
