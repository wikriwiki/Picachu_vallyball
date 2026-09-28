/**
 * @pyramid-spec      design/client/display/log/log.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/log/log.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import type { ClientCtx } from '../../ctx';

export const LOG_LINES = 150;

export function createLog(ctx: Pick<ClientCtx, 'shell' | 'connection' | 'doc'>) {
  const { shell, connection, doc } = ctx;
  const list = shell.el('log-list');
  shell.el('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = shell.el<HTMLInputElement>('chat-input');
    const text = input.value.trim();
    if (text) connection.send({ type: 'chat', text });
    input.value = '';
  });
  return {
    add(html: string) {
      const d = doc.createElement('div');
      d.innerHTML = html;
      list.appendChild(d);
      while (list.children.length > LOG_LINES) list.firstElementChild!.remove();
      list.scrollTop = list.scrollHeight;
    },
    toggle() { shell.setHidden('log-panel', !shell.isHidden('log-panel')); },
    isOpen: () => !shell.isHidden('log-panel'),
  };
}
