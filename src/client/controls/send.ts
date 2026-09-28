/**
 * @pyramid-spec      design/client/controls/controls.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/controls/controls.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { Action } from '../../engine/engine';
import type { ClientCtx } from '../ctx';

export function sendAction(ctx: Pick<ClientCtx, 'store' | 'connection' | 'controls'>, action: Action): void {
  const s = ctx.store.get('state');
  if (s) ctx.store.set({ sentSeq: s.seq });
  ctx.connection.send({ type: 'action', action });
  ctx.controls.updateControls();
}
