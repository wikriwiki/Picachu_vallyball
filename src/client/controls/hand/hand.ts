/**
 * @pyramid-spec      design/client/controls/hand/hand.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/hand/hand.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import { CARDS, type CardId } from '../../../data/data';
import type { Action, Pending, Player } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';
import { esc } from '../../display/display';

export function canUseCard(me: Player, p: Pending | null, card: CardId): boolean {
  const c = CARDS[card];
  return !!p && p.type === 'spin' && p.purpose === 'move' && !me.cardUsed && c.timing !== 'passive' && !(c.adultOnly && !me.job);
}

export function initHand(ctx: ClientCtx, send: (a: Action) => void) {
  const { shell, store, doc } = ctx;
  shell.el('num-cancel').addEventListener('click', () => shell.setHidden('modal-number', true));
  const openNumbers = (index: number) => {
    const grid = shell.el('num-grid');
    grid.innerHTML = '';
    for (let n = 1; n <= 10; n++) {
      const b = doc.createElement('button');
      b.className = 'btn';
      b.textContent = String(n);
      b.addEventListener('click', () => { shell.setHidden('modal-number', true); send({ type: 'card', index, number: n }); });
      grid.appendChild(b);
    }
    shell.setHidden('modal-number', false);
  };
  return {
    update(p: Pending | null) {
      const hand = shell.el('hand');
      hand.innerHTML = '';
      const me = store.myPlayer();
      if (!store.get('state') || !me) return;
      me.cards.forEach((id, i) => {
        const c = CARDS[id];
        const usable = canUseCard(me, p, id);
        const d = doc.createElement('div');
        d.className = 'card' + (usable ? '' : ' disabled');
        d.innerHTML = `<div class="cn">${esc(c.name)}</div><div>${esc(c.desc)}</div>`;
        if (usable) d.addEventListener('click', () => { if (id === 'fixed') openNumbers(i); else send({ type: 'card', index: i }); });
        hand.appendChild(d);
      });
    },
  };
}
