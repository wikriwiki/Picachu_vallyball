/**
 * @pyramid-spec      design/engine/tiles/life/life.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/life/life.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { BIRTH_GIFT, CHOICES, ERAS, ERA_GROUP, HOUSES, KID_NAMES, formatMoney, type Tile } from '../../../data/data';
import {
  addFortune, addMoney, applyEffects, collectFromOthers, gainCard,
  type ChoiceResolver, type Ctx, type Player, type SpinResolver,
} from '../../core/core';
import { onChallengeTile, onMarriageStop } from '../../systems/systems';

function choiceTable(era: number) {
  const g = ERA_GROUP[ERAS[era].id];
  if (g === 'baby' || g === 'kid') return CHOICES.kid;
  if (g === 'teen') return CHOICES.teen;
  if (g === 'final') return CHOICES.final;
  return CHOICES.adult;
}

export function onChoice(ctx: Ctx, p: Player): void {
  const c = ctx.choose(choiceTable(ctx.state.era));
  ctx.state.pending = {
    type: 'choice', kind: 'event', playerId: p.id, title: c.t,
    options: c.o.map((o) => ({ label: o.l, effect: { ...o.e } })),
  };
}

export const resolveEvent: ChoiceResolver = (ctx, p, pend, idx) => {
  const opt = pend.options[idx];
  ctx.msg(p, `「${opt.label}」`, 'event');
  applyEffects(ctx, p, opt.effect);
};

export const resolveGamble: SpinResolver = (ctx, p, pend, value) => {
  const amount = pend.amount ?? 0;
  if (value >= 5) { ctx.msg(p, '투자 대성공! 3배가 되었다!', 'lucky'); addMoney(ctx, p, amount * 2, '투자 수익'); }
  else { ctx.msg(p, '투자 실패... 돈을 잃었다.', 'bad'); addMoney(ctx, p, -amount, '투자 손실'); }
};

export function onCard(ctx: Ctx, p: Player): void {
  ctx.msg(p, '카드 칸! 카드를 1장 받았다.', 'card');
  gainCard(ctx, p);
}

export function onBaby(ctx: Ctx, p: Player): void {
  if (p.spouse) {
    const name = ctx.choose(KID_NAMES);
    p.kids.push(name);
    ctx.events.push({ t: 'kid', pid: p.id, name, count: p.kids.length });
    ctx.msg(p, `아기 「${name}」(이)가 태어났다! 모두에게서 축하금을 받는다.`, 'love');
    collectFromOthers(ctx, p, BIRTH_GIFT, '출산 축하금');
  } else {
    ctx.msg(p, '조카가 태어났다! 선물을 샀다.', 'event');
    addMoney(ctx, p, -100, '선물');
    addFortune(ctx, p, 1);
  }
}

export function onChallenge(ctx: Ctx, p: Player): void {
  onChallengeTile(ctx, p);
}

export function onStop(ctx: Ctx, p: Player, tile: Tile): void {
  if (tile.stop === 'marriage') { onMarriageStop(ctx, p); return; }
  if (tile.stop === 'house') {
    ctx.state.pending = {
      type: 'choice', kind: 'house', playerId: p.id, title: '내 집 마련 STOP! 집을 살까요? (결과 발표에서 감정)',
      options: [
        ...HOUSES.map((h) => ({ label: h.name, desc: formatMoney(h.price), houseId: h.id })),
        { label: '사지 않는다', desc: '현금을 지킨다' },
      ],
    };
  }
}

export const resolveHouse: ChoiceResolver = (ctx, p, pend, idx) => {
  const h = HOUSES.find((x) => x.id === pend.options[idx].houseId);
  if (!h) { ctx.msg(p, '집은 사지 않기로 했다.', 'info'); return; }
  p.houses.push({ id: h.id, name: h.name, price: h.price });
  ctx.msg(p, `「${h.name}」를 샀다!`, 'lucky');
  addMoney(ctx, p, -h.price, '주택 구입');
  ctx.events.push({ t: 'house', pid: p.id, house: h.id });
};

export function onEnd(ctx: Ctx, p: Player): void {
  p.doneEra = true;
  ctx.msg(p, `${ERAS[ctx.state.era].name} 도착! 다른 사람을 기다린다.`, 'info');
}

export function onGoal(ctx: Ctx, p: Player): void {
  p.finished = true;
  p.finishOrder = ctx.state.finishCount++;
  ctx.events.push({ t: 'goal', pid: p.id, order: p.finishOrder });
  ctx.msg(p, `${p.finishOrder + 1}등으로 GOAL!`, 'lucky');
}
