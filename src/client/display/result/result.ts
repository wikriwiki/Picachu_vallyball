/**
 * @pyramid-spec      design/client/display/result/result.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/result/result.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { formatMoney } from '../../../data/data';
import type { PublicState } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';
import { esc } from '../notice/notice';
import type { Sound } from '../sound/sound';

export function createResult(
  ctx: Pick<ClientCtx, 'shell' | 'store' | 'connection' | 'getView' | 'doc'>,
  sound: Sound,
  deps: { sleep?: (ms: number) => Promise<void>; location?: { pathname: string; assign(url: string): void } } = {},
) {
  const { shell, store, connection, doc } = ctx;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const loc = () => deps.location ?? globalThis.location;
  shell.el('btn-rematch').addEventListener('click', () => connection.send({ type: 'rematch' }));
  shell.el('btn-exit').addEventListener('click', () => {
    connection.send({ type: 'leave' });
    connection.clearSession();
    loc().assign(loc().pathname);
  });
  return {
    async show(s: PublicState) {
      const res = s.result;
      if (!res) return;
      shell.setHidden('modal-result', false);
      const cols = shell.el('result-cols');
      cols.innerHTML = '';
      shell.el('ranking').innerHTML = '';
      const room = store.get('room');
      shell.setHidden('btn-rematch', !(room && room.hostId === store.get('me')));
      const colEls = new Map<string, { items: HTMLElement; tot: HTMLElement; sum: number }>();
      for (const r of res.rows) {
        const p = s.players.find((x) => x.id === r.pid)!;
        const c = doc.createElement('div');
        c.className = 'rcol';
        c.innerHTML = `<h3><span class="dot" style="display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #2a2238;background:${esc(p.avatar.shirt)}"></span>${esc(p.name)}</h3><div class="items"></div><div class="tot">0원</div>`;
        cols.appendChild(c);
        colEls.set(r.pid, { items: c.querySelector('.items') as HTMLElement, tot: c.querySelector('.tot') as HTMLElement, sum: 0 });
      }
      const maxItems = Math.max(...res.rows.map((r) => r.items.length));
      for (let i = 0; i < maxItems; i++) {
        for (const r of res.rows) {
          const it = r.items[i];
          if (!it) continue;
          const ce = colEls.get(r.pid)!;
          const d = doc.createElement('div');
          d.className = 'it';
          d.innerHTML = `<span>${esc(it.label)}</span><span class="a${it.amount < 0 ? ' neg' : ''}">${it.amount >= 0 ? '+' : ''}${formatMoney(it.amount)}</span>`;
          ce.items.appendChild(d);
          ce.sum += it.amount;
          ce.tot.textContent = formatMoney(ce.sum);
        }
        if (i === 0) sound.money(); else sound.tick();
        await sleep(700);
      }
      sound.fanfare();
      const view = ctx.getView();
      const winner = res.ranking[0];
      if (view) { view.flash(0.6); view.focus(winner); view.confettiAt(winner); }
      shell.el('ranking').innerHTML = res.ranking.map((pid, i) => {
        const p = s.players.find((x) => x.id === pid)!;
        const r = res.rows.find((x) => x.pid === pid)!;
        return `<div class="rank${i === 0 ? ' first' : ''}">${i === 0 ? '👑 ' : ''}${i + 1}위 ${esc(p.name)}<br>${formatMoney(r.total)}</div>`;
      }).join('');
    },
    hide() { shell.setHidden('modal-result', true); },
  };
}
