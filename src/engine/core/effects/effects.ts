/**
 * @pyramid-spec      design/engine/core/effects/effects.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/effects/effects.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import {
  ADULT_ERA, CARDS, CARD_POOL, ERAS, FORTUNES, HAND_MAX, MIN_ALLOWANCE, MIN_SALARY_UNIT, NOTE_UNIT, STAT_MAX, TREASURES,
  formatMoney, jobById, type CardId, type Effect, type StatKey,
} from '../../../data/data';
import type { Ctx, Player } from '../types/types';

export function salaryOf(p: Player): number {
  if (!p.job) return 0;
  const job = jobById(p.job);
  return job ? job.ranks[p.rank].salary : 0;
}

export function incomeUnit(ctx: Ctx, p: Player): number {
  const era = ctx.state.era;
  if (era >= ADULT_ERA) return Math.max(salaryOf(p), MIN_SALARY_UNIT);
  return Math.max(ERAS[era].allowance, MIN_ALLOWANCE);
}

export function addMoney(ctx: Ctx, p: Player, delta: number, reason: string): void {
  if (!delta) return;
  p.money += delta;
  ctx.events.push({ t: 'money', pid: p.id, delta, reason });
  let borrowed = 0;
  while (p.money < 0) {
    p.money += NOTE_UNIT;
    p.notes += 1;
    borrowed++;
  }
  if (borrowed) ctx.events.push({ t: 'note', pid: p.id, count: borrowed, total: p.notes });
}

export function addStat(ctx: Ctx, p: Player, k: StatKey, d: number): void {
  if (!d) return;
  const before = p.stats[k];
  p.stats[k] = Math.max(0, Math.min(STAT_MAX, before + d));
  const real = p.stats[k] - before;
  if (real) ctx.events.push({ t: 'stat', pid: p.id, stat: k, delta: real, value: p.stats[k] });
}

export function addFortune(ctx: Ctx, p: Player, d: number): void {
  const before = p.fortune;
  p.fortune = Math.max(0, Math.min(FORTUNES.length - 1, before + d));
  if (p.fortune !== before) ctx.events.push({ t: 'fortune', pid: p.id, delta: p.fortune - before, value: p.fortune });
}

export function addAffinity(ctx: Ctx, p: Player, d: number): void {
  if (!p.partner) return;
  const before = p.partner.affinity;
  p.partner.affinity = Math.max(0, Math.min(100, before + d));
  ctx.events.push({ t: 'affinity', pid: p.id, delta: p.partner.affinity - before, value: p.partner.affinity });
}

export function gainCard(ctx: Ctx, p: Player): void {
  if (p.cards.length >= HAND_MAX) {
    ctx.msg(p, '카드가 가득 차서 받을 수 없었다.');
    return;
  }
  let id: CardId;
  do { id = ctx.choose(CARD_POOL); } while (CARDS[id].adultOnly && ctx.state.era < ADULT_ERA);
  p.cards.push(id);
  ctx.events.push({ t: 'card', pid: p.id, card: id, gained: true });
  ctx.log(`${p.name}: ${CARDS[id].name} 획득`);
}

export function gainTreasure(ctx: Ctx, p: Player): void {
  const tr = ctx.choose(TREASURES);
  p.treasures.push({ name: tr.name, base: tr.base });
  ctx.events.push({ t: 'treasure', pid: p.id, name: tr.name });
  ctx.log(`${p.name}: 보물 「${tr.name}」 획득`);
}

export function collectFromOthers(ctx: Ctx, p: Player, amount: number, reason: string): void {
  let total = 0;
  for (const o of ctx.state.players) {
    if (o === p) continue;
    addMoney(ctx, o, -amount, reason);
    total += amount;
  }
  if (total) addMoney(ctx, p, total, reason);
}

export function applyEffects(ctx: Ctx, p: Player, e: Effect | undefined): void {
  if (!e) return;
  if (e.money != null) {
    const amt = e.money === 'salary' ? incomeUnit(ctx, p) : e.money === 'salary2' ? incomeUnit(ctx, p) * 2 : e.money;
    addMoney(ctx, p, amt, amt >= 0 ? '수입' : '지출');
  }
  for (const k of ['int', 'phy', 'sen'] as const) if (e[k]) addStat(ctx, p, k, e[k] as number);
  if (e.fortune) addFortune(ctx, p, e.fortune);
  if (e.love && p.partner && !p.spouse) addAffinity(ctx, p, e.love * 10);
  if (e.card) for (let i = 0; i < e.card; i++) gainCard(ctx, p);
  if (e.treasure) for (let i = 0; i < e.treasure; i++) gainTreasure(ctx, p);
  if (e.gamble) {
    ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'gamble', amount: e.gamble, title: `투자 ${formatMoney(e.gamble)} — 5 이상이면 성공!` };
  }
}

export function doublePositive(e: Effect): Effect {
  const out: Effect = { ...e };
  for (const k of ['int', 'phy', 'sen', 'love'] as const) if ((out[k] ?? 0) > 0) out[k] = (out[k] as number) * 2;
  if (typeof out.money === 'number' && out.money > 0) out.money *= 2;
  if (out.money === 'salary') out.money = 'salary2';
  return out;
}
