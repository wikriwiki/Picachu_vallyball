/**
 * @pyramid-spec      design/client/controls/choice/choice.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/choice/choice.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import type { Action, Pending } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';
import type { Store } from '../../store/store';
import { esc } from '../../display/display';

export function promptText(store: Store): { text: string; wait: boolean } {
  const p = store.myPending();
  if (p) return { text: p.title, wait: false };
  const s = store.get('state');
  if (s && s.phase === 'playing' && s.pending && !store.get('busy') && store.get('queued') === 0) {
    if (s.pending.playerId === store.get('me')) return { text: '처리 중...', wait: true };
    const who = s.players.find((x) => x.id === s.pending!.playerId);
    return { text: `${who?.name ?? ''} ${s.pending.type === 'choice' ? '선택 중...' : '룰렛 대기 중...'}`, wait: true };
  }
  return { text: '', wait: false };
}

export function initChoice(ctx: ClientCtx, send: (a: Action) => void) {
  const { shell, store, doc } = ctx;
  return {
    update(p: Pending | null) {
      const pr = promptText(store);
      const prompt = shell.el('prompt');
      prompt.textContent = pr.text;
      prompt.className = 'prompt' + (pr.wait ? ' wait' : '');
      if (p && p.type === 'choice') {
        shell.el('choice-title').textContent = p.title;
        const list = shell.el('choice-list');
        list.className = 'choice-list' + (p.options.length > 6 ? ' grid2' : '');
        list.innerHTML = '';
        p.options.forEach((o, i) => {
          const b = doc.createElement('button');
          b.className = 'opt';
          b.disabled = !!o.disabled;
          b.innerHTML = `${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}`;
          b.addEventListener('click', () => { shell.setHidden('modal-choice', true); send({ type: 'choose', index: i }); });
          list.appendChild(b);
        });
        shell.setHidden('modal-choice', false);
      } else shell.setHidden('modal-choice', true);
    },
  };
}
