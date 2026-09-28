/**
 * @pyramid-spec      design/client/display/status/status.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/status/status.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { CARDS, FORTUNES, PERSONALITY_NAMES, STAT_NAMES, formatMoney, gradeOf, jobById, type StatKey } from '../../../data/data';
import type { Player, PublicState } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';
import { esc } from '../notice/notice';
import { jobLabel } from '../hud/hud';

export function statusCardHtml(s: PublicState, p: Player): string {
  const c = p.partner ? s.partners.find((x) => x.id === p.partner!.id) : null;
  const j = jobById(p.job);
  const stat = (k: StatKey) => `${STAT_NAMES[k]} <b>${gradeOf(p.stats[k])}</b> (${p.stats[k]})`;
  const rel = p.spouse
    ? `💍 배우자: ${esc(p.spouse)}`
    : c ? `💗 ${esc(c.name)} (${esc(c.job)}, ${'★'.repeat(c.stars)}, ${PERSONALITY_NAMES[c.personality]})<div class="bar"><i style="width:${p.partner!.affinity}%"></i></div>`
      : '💭 관심 있는 사람 없음';
  return `<div class="status-card"><h3>${esc(p.name)}</h3>
    💰 ${formatMoney(p.money)}${p.notes ? ` · 약속어음 ${p.notes}장` : ''}<br>
    ${j ? `${j.icon} ${esc(j.name)} · ${esc(j.ranks[p.rank].name)} (월급 ${formatMoney(j.ranks[p.rank].salary)})` : esc(jobLabel(p, s.era))}<br>
    ${stat('int')} · ${stat('phy')} · ${stat('sen')}<br>
    운세 <b>${FORTUNES[p.fortune]}</b><br>
    ${rel}
    ${p.kids.length ? `<br>👶 자녀: ${p.kids.map(esc).join(', ')}` : ''}
    ${p.houses.length ? `<br>🏠 ${p.houses.map((h) => esc(h.name)).join(', ')}` : ''}
    ${p.treasures.length ? `<br>💎 ${p.treasures.map((t) => esc(t.name)).join(', ')}` : ''}
    ${p.cards.length ? `<br>🃏 ${p.cards.map((k) => esc(CARDS[k].name)).join(', ')}` : ''}
  </div>`;
}

export function createStatus(ctx: Pick<ClientCtx, 'shell' | 'store'>) {
  const { shell, store } = ctx;
  shell.el('status-close').addEventListener('click', () => shell.setHidden('modal-status', true));
  return {
    open() {
      const s = store.get('state');
      if (!s) return;
      shell.el('status-body').innerHTML = `<div class="status-grid">${s.players.map((p) => statusCardHtml(s, p)).join('')}</div>`;
      shell.setHidden('modal-status', false);
    },
  };
}
