/**
 * @pyramid-spec      design/client/controls/controls.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/controls/controls.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { Action } from '../../engine/engine';
import type { ClientCtx } from '../ctx';
import { sendAction } from './send';
import { initSpin } from './spin/spin';
import { initChoice } from './choice/choice';
import { initHand } from './hand/hand';
import { initMenu } from './menu/menu';

export interface Controls { updateControls(): void; }

export function initControls(ctx: ClientCtx): Controls {
  const send = (a: Action) => sendAction(ctx, a);
  const spin = initSpin(ctx, send);
  const choice = initChoice(ctx, send);
  const hand = initHand(ctx, send);
  initMenu(ctx);
  return {
    updateControls() {
      const p = ctx.store.myPending();
      spin.update(p);
      choice.update(p);
      hand.update(p);
    },
  };
}
