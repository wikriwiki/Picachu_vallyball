/**
 * @pyramid-spec      design/engine/tiles/crisis/crisis.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/crisis/crisis.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { ERAS, ERA_GROUP, GHOST, HIYARI, HIYARI_SPIN, STAT_NAMES, type StatKey } from '../../../data/data';
import { addFortune, addStat, applyEffects, type Ctx, type Player, type SpinResolver } from '../../core/core';

function tableKey(era: number): 'baby' | 'kid' | 'adult' | 'final' {
  const g = ERA_GROUP[ERAS[era].id];
  if (g === 'baby') return 'baby';
  if (g === 'kid' || g === 'teen') return 'kid';
  if (g === 'final') return 'final';
  return 'adult';
}

export function onHiyari(ctx: Ctx, p: Player): void {
  const e = ctx.choose(HIYARI[tableKey(ctx.state.era)]);
  ctx.msg(p, e.t, 'bad');
  const stat = ctx.choose<StatKey>(['int', 'phy', 'sen']);
  ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'hiyari', stat, title: `아슬아슬 룰렛! ${STAT_NAMES[stat]}이(가) 변동합니다` };
}

export const resolveHiyari: SpinResolver = (ctx, p, pend, value) => {
  const d = HIYARI_SPIN[value - 1];
  const stat = pend.stat ?? 'int';
  ctx.msg(p, d >= 0 ? `위기를 기회로! ${STAT_NAMES[stat]} +${d}` : `${STAT_NAMES[stat]} ${d}...`, d >= 0 ? 'lucky' : 'bad');
  addStat(ctx, p, stat, d);
};

export function onGhost(ctx: Ctx, p: Player): void {
  const idx = p.cards.indexOf('insurance');
  if (idx >= 0) {
    p.cards.splice(idx, 1);
    ctx.events.push({ t: 'card', pid: p.id, card: 'insurance', used: true });
    ctx.msg(p, '유령이 나타났다! ...하지만 보험 카드로 막아냈다!', 'lucky');
    return;
  }
  const e = ctx.choose(GHOST[tableKey(ctx.state.era)]);
  ctx.msg(p, '👻 ' + e.t, 'bad');
  applyEffects(ctx, p, e.e);
  addFortune(ctx, p, -1);
}
