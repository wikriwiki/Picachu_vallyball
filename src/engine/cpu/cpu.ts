/**
 * @pyramid-spec      design/engine/cpu/cpu.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/cpu/cpu.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { CARDS, HOUSES, jobById, type StatKey } from '../../data/data';
import type { Action, GameState } from '../core/core';

export function chooseAction(state: GameState, rand: () => number = Math.random): Action | null {
  const pend = state.pending;
  if (!pend) return null;
  const p = state.players.find((x) => x.id === pend.playerId);
  if (!p) return null;
  if (pend.type === 'spin') {
    if (pend.purpose === 'move' && !p.cardUsed && p.cards.length) {
      const idx = p.cards.findIndex((c) => CARDS[c].timing === 'now' && !(CARDS[c].adultOnly && !p.job));
      if (idx >= 0 && rand() < 0.6) return { type: 'card', index: idx };
      const d = p.cards.indexOf('double');
      if (d >= 0 && rand() < 0.4) return { type: 'card', index: d };
    }
    return { type: 'spin', power: rand() };
  }
  const enabled = pend.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const choose = (index: number): Action => ({ type: 'choose', index });
  switch (pend.kind) {
    case 'job': {
      let best = enabled[0];
      let bestScore = -1;
      for (const i of enabled) {
        const j = jobById(pend.options[i].jobId)!;
        const score = j.ranks[Math.min(2, j.ranks.length - 1)].salary * (0.7 + rand() * 0.6);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return choose(best);
    }
    case 'career': return choose(p.stats.int >= 25 ? 0 : 1);
    case 'route': {
      const loveIdx = pend.options.findIndex((o) => o.route === 'love');
      if (loveIdx >= 0) {
        const wantLove = !p.spouse && rand() < (p.partner ? 0.7 : 0.5);
        return choose(wantLove ? loveIdx : 1 - loveIdx);
      }
      return choose(Math.floor(rand() * pend.options.length));
    }
    case 'crush': {
      const top = (['int', 'phy', 'sen'] as StatKey[]).reduce((a, b) => (p.stats[b] > p.stats[a] ? b : a), 'int');
      const i = pend.options.findIndex((o) => o.partnerId && state.partners.find((c) => c.id === o.partnerId)?.personality === top);
      return choose(i >= 0 ? i : 0);
    }
    case 'propose': return choose(0);
    case 'destiny': {
      const cand = state.partners.find((c) => c.id === pend.candidate);
      const cur = p.partner ? state.partners.find((c) => c.id === p.partner!.id) : null;
      return choose(cur && cand && cand.stars > cur.stars && p.partner!.affinity < 50 ? 0 : 1);
    }
    case 'travel': return choose(rand() < 0.7 ? 0 : 1);
    case 'bet': return choose(p.money >= 3000 && rand() < 0.3 ? 1 : p.money >= 1000 ? 0 : 2);
    case 'house': {
      let best = pend.options.length - 1;
      pend.options.forEach((o, i) => {
        const h = HOUSES.find((x) => x.id === o.houseId);
        if (h && h.price <= p.money) best = i;
      });
      return choose(best);
    }
    default:
      return choose(enabled[Math.floor(rand() * enabled.length)]);
  }
}
