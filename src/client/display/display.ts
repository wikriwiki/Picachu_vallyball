/**
 * @pyramid-spec      design/client/display/display.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/display/display.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { MsgKind, PublicState } from '../../engine/engine';
import type { ClientCtx } from '../ctx';
import { createNotice, type FloatKind } from './notice/notice';
import { createSound, type Sound } from './sound/sound';
import { createLog } from './log/log';
import { createHud } from './hud/hud';
import { createStatus } from './status/status';
import { createResult } from './result/result';

export type { MsgKind } from '../../engine/engine';
export type { FloatKind } from './notice/notice';
export { esc } from './notice/notice';

export interface Display {
  renderHud(s: PublicState): void;
  renderPlayers(s?: PublicState): void;
  message(text: string, kind: MsgKind, pid?: string | null): void;
  floater(pid: string, text: string, kind: FloatKind): void;
  banner(html: string, ms: number): Promise<void>;
  toast(text: string, error?: boolean): void;
  addLog(html: string): void;
  isLogOpen(): boolean;
  toggleLog(): void;
  openStatus(): void;
  showResult(s: PublicState): Promise<void>;
  hideResult(): void;
  readonly sound: Sound;
}

export function createDisplay(ctx: Pick<ClientCtx, 'shell' | 'store' | 'connection' | 'getView' | 'doc'>): Display {
  const sound = createSound();
  const notice = createNotice(ctx);
  const log = createLog(ctx);
  const hud = createHud(ctx);
  const status = createStatus(ctx);
  const result = createResult(ctx, sound);
  return {
    renderHud: (s) => hud.render(s),
    renderPlayers(s) { const x = s ?? ctx.store.get('shown'); if (x) hud.renderPlayers(x); },
    message: notice.message, floater: notice.floater, banner: notice.banner, toast: notice.toast,
    addLog: log.add, isLogOpen: log.isOpen, toggleLog: log.toggle,
    openStatus: status.open, showResult: result.show, hideResult: result.hide,
    sound,
  };
}
