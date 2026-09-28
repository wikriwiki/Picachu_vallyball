/**
 * @pyramid-spec      design/client/display/hud/hud.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/hud/hud.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { BOARD, ERAS, FORTUNES, SUBMAPS, formatMoney, gradeOf, jobById, stepsToPayday, type Avatar, type SubmapId } from '../../../data/data';
import type { Player, PublicState } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';
import { esc } from '../notice/notice';

const STAGE_LABEL = ['👶 아기', '🎒 초등학생', '🏫 중학생', '🎓 고등학생', '🧑 구직 중', '🧑 구직 중', '👴 은퇴'];

export function jobLabel(p: Player, era: number): string {
  const j = jobById(p.job);
  if (j) return `${j.icon} ${j.ranks[p.rank].name}`;
  return STAGE_LABEL[era] ?? '';
}
export function partnerLabel(s: PublicState, p: Player): string {
  if (p.spouse) return `💍 ${p.spouse}` + (p.kids.length ? ` 👶×${p.kids.length}` : '');
  if (!p.partner) return '';
  const c = s.partners?.find((x) => x.id === p.partner!.id);
  return c ? `💗 ${c.name} ${'★'.repeat(c.stars)} ${p.partner.affinity}%` : '';
}
export function turnLine(s: PublicState): string {
  const era = ERAS[s.era];
  return era.turns ? `턴 ${Math.min(s.round + 1, era.turns)}/${era.turns}` : '골을 향해!';
}
export function payLine(s: PublicState, p: Player): string {
  const t = BOARD.tiles[p.tile];
  if (t && t.era < 0) return `✈️ ${SUBMAPS[t.sub as SubmapId].name} 여행 중`;
  const n = stepsToPayday(p.tile);
  if (n == null) return '';
  const label = s.era < 4 ? '용돈날' : s.era === 6 ? '연금날' : '월급날';
  return `${label}까지 ${n}칸`;
}

export function drawFace(canvas: HTMLCanvasElement, av: Avatar): void {
  let g: CanvasRenderingContext2D | null = null;
  try { g = canvas.getContext('2d'); } catch { g = null; }
  if (!g) return;
  const w = canvas.width;
  g.clearRect(0, 0, w, w);
  g.fillStyle = '#d0ebff'; g.fillRect(0, 0, w, w);
  g.fillStyle = av.shirt; g.beginPath(); g.ellipse(w / 2, w * 1.05, w * 0.42, w * 0.3, 0, 0, 7); g.fill();
  g.fillStyle = av.skin; g.beginPath(); g.arc(w / 2, w * 0.5, w * 0.28, 0, 7); g.fill();
  g.fillStyle = av.hair; g.beginPath(); g.arc(w / 2, w * 0.44, w * 0.3, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  if ((av.hairStyle | 0) === 2) { g.fillRect(w * 0.2, w * 0.42, w * 0.1, w * 0.36); g.fillRect(w * 0.7, w * 0.42, w * 0.1, w * 0.36); }
  if ((av.hairStyle | 0) === 3) { g.beginPath(); g.arc(w / 2, w * 0.12, w * 0.1, 0, 7); g.fill(); }
  g.fillStyle = '#2a2238';
  const eh = (av.face | 0) === 1 ? 2 : 6;
  g.fillRect(w * 0.38 - 3, w * 0.52 - eh / 2, 6, eh); g.fillRect(w * 0.62 - 3, w * 0.52 - eh / 2, 6, eh);
  if ((av.face | 0) === 2) { g.strokeStyle = '#2a2238'; g.lineWidth = 2; g.strokeRect(w * 0.3, w * 0.47, w * 0.16, w * 0.1); g.strokeRect(w * 0.54, w * 0.47, w * 0.16, w * 0.1); }
  g.fillStyle = '#ff8fab'; g.beginPath(); g.arc(w * 0.32, w * 0.62, 4, 0, 7); g.arc(w * 0.68, w * 0.62, 4, 0, 7); g.fill();
}

export function createHud(ctx: Pick<ClientCtx, 'shell' | 'store'>) {
  const { shell, store } = ctx;
  const renderPlayers = (s: PublicState) => {
    const members = store.get('room')?.members ?? [];
    const me = store.get('me');
    const f = store.focusPlayer(s);
    shell.el('players').innerHTML = s.players.map((p) => {
      const mem = members.find((m) => m.id === p.id);
      const off = mem && !mem.connected && !p.cpu;
      const active = s.pending && s.pending.playerId === p.id;
      const t = BOARD.tiles[p.tile];
      const extra = [partnerLabel(s, p), p.cards.length ? `🃏${p.cards.length}` : '', p.treasures.length ? `💎${p.treasures.length}` : '',
        p.houses.length ? `🏠${p.houses.length}` : '', p.notes ? `📄×${p.notes}` : '', p.finished ? '🏁' : '', t && t.era < 0 ? '✈️' : '']
        .filter(Boolean).join(' ');
      return `<div class="pcard${active ? ' active' : ''}${p.id === f.id ? ' is-main' : ''}">
        <div class="top"><div class="dot" style="background:${esc(p.avatar.shirt)}"></div><div class="nm">${esc(p.name)} ${p.id === me ? '<span class="me">나</span>' : ''}${off ? '<span class="off">오프라인</span>' : ''}${p.cpu ? '<span class="off">CPU</span>' : ''}</div><div class="money${p.money < 0 ? ' neg' : ''}">${formatMoney(p.money)}</div></div>
        <div class="job">${esc(jobLabel(p, s.era))}</div>
        ${extra ? `<div class="extra">${esc(extra)}</div>` : ''}
      </div>`;
    }).join('');
  };
  return {
    render(s: PublicState) {
      const f = store.focusPlayer(s);
      shell.el('era-name').textContent = ERAS[s.era].name;
      shell.el('era-turn').textContent = turnLine(s);
      shell.el('pay-line').textContent = payLine(s, f);
      drawFace(shell.el<HTMLCanvasElement>('hud-portrait'), f.avatar);
      shell.el('hud-name').textContent = f.name + (f.id === store.get('me') ? ' (나)' : '');
      shell.el('hud-job').textContent = jobLabel(f, s.era);
      shell.el('hud-stats').innerHTML = `<span>지력<b>${gradeOf(f.stats.int)}</b></span><span>체력<b>${gradeOf(f.stats.phy)}</b></span><span>센스<b>${gradeOf(f.stats.sen)}</b></span><span>운세<b>${FORTUNES[f.fortune]}</b></span>`;
      shell.el('hud-partner').textContent = partnerLabel(s, f);
      shell.el('hud-money').textContent = formatMoney(f.money) + (f.notes ? ` 📄×${f.notes}` : '');
      renderPlayers(s);
    },
    renderPlayers,
  };
}
