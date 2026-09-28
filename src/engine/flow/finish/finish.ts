/**
 * @pyramid-spec      design/engine/flow/finish/finish.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/finish/finish.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { AWARD_BONUS, GOAL_BONUS, KID_GIFT, NOTE_REPAY, TREASURE_MULT } from '../../../data/data';
import { salaryOf, type Ctx, type Player, type ResultItem, type ResultRow } from '../../core/core';

export const AWARDS: readonly { name: string; value(p: Player): number }[] = [
  { name: '최고 연봉상', value: (p) => salaryOf(p) },
  { name: '대가족상', value: (p) => p.kids.length },
  { name: '박사상 (지력 최고)', value: (p) => p.stats.int },
  { name: '철인상 (체력 최고)', value: (p) => p.stats.phy },
  { name: '아티스트상 (센스 최고)', value: (p) => p.stats.sen },
  { name: '행운상 (운세 최고)', value: (p) => p.fortune },
];

export function finishGame(ctx: Ctx): void {
  const s = ctx.state;
  s.phase = 'ended';
  s.pending = null;
  const rows: ResultRow[] = s.players.map((p) => {
    const items: ResultItem[] = [{ label: '현금', amount: p.money }];
    for (const t of p.treasures) {
      const v = 1 + ctx.rint(10);
      const mult = TREASURE_MULT[v - 1];
      items.push({ label: `보물 감정 「${t.name}」 (룰렛 ${v} → ×${mult})`, amount: Math.round(t.base * mult) });
    }
    for (const h of p.houses) {
      const v = 1 + ctx.rint(10);
      const mult = 0.7 + v * 0.1;
      items.push({ label: `집 감정 「${h.name}」 (룰렛 ${v} → ×${mult.toFixed(1)})`, amount: Math.round(h.price * mult) });
    }
    if (p.kids.length) items.push({ label: `자녀 ${p.kids.length}명의 효도 선물`, amount: p.kids.length * KID_GIFT });
    if (p.finishOrder != null && GOAL_BONUS[p.finishOrder]) items.push({ label: `GOAL ${p.finishOrder + 1}등 보너스`, amount: GOAL_BONUS[p.finishOrder] });
    if (p.notes) items.push({ label: `약속어음 ${p.notes}장 상환`, amount: -p.notes * NOTE_REPAY });
    return { pid: p.id, items, total: 0 };
  });
  for (const a of AWARDS) {
    const max = Math.max(...s.players.map(a.value));
    if (max <= 0) continue;
    const winners = s.players.filter((p) => a.value(p) === max);
    if (winners.length === s.players.length && s.players.length > 1) continue;
    for (const w of winners) rows.find((r) => r.pid === w.id)!.items.push({ label: `특별상: ${a.name}`, amount: AWARD_BONUS });
  }
  for (const r of rows) r.total = r.items.reduce((sum, it) => sum + it.amount, 0);
  const ranking = [...rows].sort((a, b) => b.total - a.total).map((r) => r.pid);
  s.result = { rows, ranking };
  ctx.events.push({ t: 'result', result: s.result });
  ctx.log('━━ 결과 발표 ━━');
}
