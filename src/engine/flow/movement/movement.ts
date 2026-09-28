/**
 * @pyramid-spec      design/engine/flow/movement/movement.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/movement/movement.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { ADULT_ERA, BOARD, ERAS, FINAL_ERA, PENSION_RATE, ROUTE_DESC, ROUTE_NAMES, jobById, type RouteId } from '../../../data/data';
import { addMoney, salaryOf, type ChoiceResolver, type Ctx, type Player, type SpinResolver } from '../../core/core';
import { promoteByStats } from '../../systems/systems';
import { resolveTile } from '../../tiles/tiles';

export function payday(ctx: Ctx, p: Player): void {
  const era = ctx.state.era;
  if (era < ADULT_ERA) {
    const a = ERAS[era].allowance;
    if (a) addMoney(ctx, p, a, '용돈');
    return;
  }
  const job = jobById(p.job);
  if (!job) return;
  if (era === FINAL_ERA) { addMoney(ctx, p, Math.round(salaryOf(p) * PENSION_RATE), '연금'); return; }
  if (job.type === 'stat') promoteByStats(ctx, p);
  if (job.type === 'free') {
    const v = 1 + ctx.rint(10);
    ctx.events.push({ t: 'spin', pid: p.id, value: v, purpose: 'freelance', auto: true });
    addMoney(ctx, p, job.ranks[0].salary * v, '프리랜서 수입');
    return;
  }
  addMoney(ctx, p, salaryOf(p), '월급');
}

export function doMove(ctx: Ctx, p: Player, steps: number, forcedNext: number | null = null): void {
  let seg: number[] = [];
  let pos = p.tile;
  const era = ctx.state.era;
  for (let k = 0; k < steps; k++) {
    const cur = BOARD.tiles[pos];
    if (!cur.next.length || cur.type === 'return') break;
    let nx: number;
    if (k === 0 && forcedNext != null) nx = forcedNext;
    else if (cur.next.length > 1) {
      if (seg.length) ctx.events.push({ t: 'move', pid: p.id, path: seg });
      p.tile = pos;
      const br = BOARD.branches.find((b) => b.junction === pos);
      const remaining = steps - k;
      ctx.state.pending = {
        type: 'choice', kind: 'route', playerId: p.id, remaining,
        title: `갈림길! 어느 길로 갈까요? (남은 ${remaining}칸)`,
        options: cur.next.map((n, idx) => {
          const route = (br ? br.routes[idx] : BOARD.tiles[n].route) as RouteId;
          return { label: ROUTE_NAMES[route] ?? route, desc: ROUTE_DESC[route] ?? '', next: n, route };
        }),
      };
      ctx.events.push({ t: 'junction', pid: p.id, tile: pos, options: [...cur.next] });
      return;
    } else nx = cur.next[0];
    pos = nx;
    seg.push(pos);
    const t = BOARD.tiles[pos];
    if (t.type === 'payday') {
      p.tile = pos;
      ctx.events.push({ t: 'move', pid: p.id, path: seg });
      seg = [];
      ctx.msg(p, era < ADULT_ERA ? '용돈날!' : era === FINAL_ERA ? '연금날!' : '월급날!', 'payday');
      payday(ctx, p);
    }
    if (t.type === 'stop' && k < steps - 1) break;
    if (t.type === 'return') break;
  }
  p.tile = pos;
  if (seg.length) ctx.events.push({ t: 'move', pid: p.id, path: seg });
  resolveTile(ctx, p);
}

export const resolveMoveSpin: SpinResolver = (ctx, p, pend, value) => {
  let steps = value;
  if (pend.double) { steps = value * 2; ctx.msg(p, `더블 카드! ${steps}칸 전진`, 'card'); }
  doMove(ctx, p, steps);
};

export const resolveRoute: ChoiceResolver = (ctx, p, pend, idx) => {
  const opt = pend.options[idx];
  ctx.msg(p, `${opt.label}(으)로 간다!`, 'info');
  doMove(ctx, p, pend.remaining ?? 0, opt.next ?? null);
};
