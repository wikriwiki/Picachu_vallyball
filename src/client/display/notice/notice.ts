/**
 * @pyramid-spec      design/client/display/notice/notice.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/notice/notice.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import type { MsgKind } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';

export type FloatKind = 'plus' | 'minus' | 'info';
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s: unknown): string { return String(s).replace(/[&<>"']/g, (c) => ESC[c]); }

export function createNotice(ctx: Pick<ClientCtx, 'shell' | 'store' | 'getView' | 'doc'>, deps: { setTimeout?: (fn: () => void, ms: number) => unknown } = {}) {
  const st = deps.setTimeout ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const { shell, store, doc } = ctx;
  return {
    message(text: string, kind: MsgKind, pid?: string | null) {
      const s = store.get('shown') ?? store.get('state');
      const name = pid && s ? s.players.find((p) => p.id === pid)?.name ?? '' : '';
      shell.el('msg-name').textContent = name;
      shell.el('msg-text').textContent = text;
      shell.el('msgbox').className = `msgbox ${kind}`;
    },
    floater(pid: string, text: string, kind: FloatKind) {
      const pos = ctx.getView()?.project(pid, 3.4);
      if (!pos) return;
      const f = doc.createElement('div');
      f.className = `floater ${kind}`;
      f.textContent = text;
      f.style.left = `${pos.x}px`;
      f.style.top = `${pos.y}px`;
      shell.el('floaters').appendChild(f);
      st(() => f.remove(), 1900);
    },
    banner(html: string, ms: number): Promise<void> {
      const inner = shell.el('banner-text');
      inner.innerHTML = html;
      shell.setHidden('banner', false);
      inner.style.animation = 'none';
      void inner.offsetWidth;
      inner.style.animation = `slideIn ${ms}ms ease-in-out forwards`;
      return new Promise((resolve) => { st(() => { shell.setHidden('banner', true); resolve(); }, ms); });
    },
    toast(text: string, error = false) {
      const t = doc.createElement('div');
      t.className = 'toast' + (error ? ' err' : '');
      t.textContent = text;
      shell.el('toasts').appendChild(t);
      st(() => t.remove(), 2600);
    },
  };
}
