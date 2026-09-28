/**
 * @pyramid-spec      design/client/controls/menu/menu.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/menu/menu.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import type { ClientCtx } from '../../ctx';

export function initMenu(ctx: ClientCtx): void {
  const { shell, display, store } = ctx;
  shell.el('cmd-card').addEventListener('click', () => {
    shell.setHidden('hand', !shell.isHidden('hand'));
    shell.el('cmd-card').classList.toggle('on', !shell.isHidden('hand'));
  });
  shell.el('cmd-status').addEventListener('click', () => display.openStatus());
  shell.el('cmd-other').addEventListener('click', () => shell.setHidden('other-menu', !shell.isHidden('other-menu')));
  let overview = false;
  shell.el('btn-view').addEventListener('click', () => {
    const view = ctx.getView();
    if (!view) return;
    overview = !overview;
    if (overview) view.overview();
    else {
      view.zoomDefault();
      const s = store.get('state');
      if (s?.pending) view.focus(s.pending.playerId);
    }
  });
  shell.el('btn-log').addEventListener('click', () => display.toggleLog());
  shell.el('btn-rules').addEventListener('click', () => shell.setHidden('modal-rules', false));
  shell.el('rules-close').addEventListener('click', () => shell.setHidden('modal-rules', true));
  const mute = shell.el('btn-mute');
  mute.textContent = display.sound.muted ? '🔇' : '🔊';
  mute.addEventListener('click', () => { mute.textContent = display.sound.toggle() ? '🔇' : '🔊'; });
}
