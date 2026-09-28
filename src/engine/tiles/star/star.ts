/**
 * @pyramid-spec      design/engine/tiles/star/star.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/star/star.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { ADULT_ERA, ERAS, ERA_GROUP, EVENTS, FORTUNES, STAR3, type Tile } from '../../../data/data';
import { addMoney, applyEffects, doublePositive, type Ctx, type Player } from '../../core/core';

function eventTable(era: number) {
  const id = ERAS[era].id;
  if (id === 'adult1' || id === 'adult2') return EVENTS.adult;
  return EVENTS[id as keyof typeof EVENTS];
}

export function onStar(ctx: Ctx, p: Player, tile: Tile): void {
  const e = ctx.choose(eventTable(ctx.state.era));
  const lv2 = tile.type === 'star2';
  ctx.msg(p, (lv2 ? '★★ ' : '★ ') + e.t, lv2 ? 'lucky' : 'event');
  applyEffects(ctx, p, lv2 ? doublePositive(e.e) : e.e);
  if (ctx.state.era >= ADULT_ERA && ctx.rnd() < 0.25) {
    if (p.fortune >= 5) {
      ctx.msg(p, `운세 「${FORTUNES[p.fortune]}」 덕분에 특별 보너스!`, 'lucky');
      addMoney(ctx, p, 1000, '운세 보너스');
    } else if (p.fortune <= 1) {
      ctx.msg(p, `운세 「${FORTUNES[p.fortune]}」... 불운이 덮쳤다.`, 'bad');
      addMoney(ctx, p, -800, '불운');
    }
  }
}

export function onStar3(ctx: Ctx, p: Player): void {
  const g = ERA_GROUP[ERAS[ctx.state.era].id];
  const e = ctx.choose(g === 'adult' || g === 'final' ? STAR3.adult : STAR3.kid);
  ctx.msg(p, '★★★ ' + e.t, 'lucky');
  applyEffects(ctx, p, e.e);
}
