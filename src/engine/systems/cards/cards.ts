/**
 * @pyramid-spec      design/engine/systems/cards/cards.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/cards/cards.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import { CARDS, formatMoney, jobById } from '../../../data/data';
import { RuleError, addFortune, addMoney, addStat, incomeUnit, type Ctx, type Player } from '../../core/core';
import { promoteOne } from '../career/career';

export function useCard(ctx: Ctx, p: Player, action: { type: 'card'; index: number; number?: number }): void {
  const pend = ctx.state.pending;
  if (!pend || pend.type !== 'spin' || pend.purpose !== 'move') throw new RuleError('카드는 이동 룰렛 전에만 사용할 수 있습니다.');
  if (p.cardUsed) throw new RuleError('카드는 한 턴에 1장만 사용할 수 있습니다.');
  const idx = action.index | 0;
  const id = p.cards[idx];
  if (!id) throw new RuleError('카드가 없습니다.');
  const c = CARDS[id];
  if (c.timing === 'passive') throw new RuleError('보험 카드는 자동으로 발동합니다.');
  if (c.adultOnly && !p.job) throw new RuleError('직업이 있어야 사용할 수 있습니다.');
  let fixed = 0;
  if (id === 'fixed') {
    fixed = (action.number ?? 0) | 0;
    if (fixed < 1 || fixed > 10) throw new RuleError('1~10 사이 숫자를 고르세요.');
  }
  p.cards.splice(idx, 1);
  p.cardUsed = true;
  ctx.events.push({ t: 'card', pid: p.id, card: id, used: true });
  ctx.log(`${p.name}: ${c.name} 사용`);
  switch (id) {
    case 'fixed': pend.fixed = fixed; pend.title = `지정 룰렛: ${fixed}`; break;
    case 'double': pend.double = true; pend.title = '더블 카드: 결과 ×2'; break;
    case 'bonus': addMoney(ctx, p, incomeUnit(ctx, p), '보너스'); break;
    case 'study': addStat(ctx, p, 'int', 10); break;
    case 'gym': addStat(ctx, p, 'phy', 10); break;
    case 'artclass': addStat(ctx, p, 'sen', 10); break;
    case 'charm': addFortune(ctx, p, 1); break;
    case 'steal': {
      let o: Player | null = null;
      for (const x of ctx.state.players) if (x !== p && (!o || x.money > o.money)) o = x;
      if (o) {
        const amt = Math.min(500, o.money);
        if (amt > 0) { addMoney(ctx, o, -amt, '가로채기 당함'); addMoney(ctx, p, amt, '가로채기'); }
        ctx.msg(p, `${o.name}에게서 ${formatMoney(amt)}을 가로챘다!`, 'card');
      }
      break;
    }
    case 'rankup': {
      if (promoteOne(ctx, p)) {
        const job = jobById(p.job)!;
        ctx.msg(p, `승진 카드! 「${job.ranks[p.rank].name}」(으)로!`, 'lucky');
      }
      break;
    }
    default: break;
  }
}
