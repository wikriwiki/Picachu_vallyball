/**
 * @pyramid-spec      design/engine/tiles/travel/travel.md
 * @pyramid-parent    design/engine/tiles/tiles.md
 * @pyramid-on-change 1) design/engine/tiles/travel/travel.md 먼저 수정 2) 이 코드 수정 3) design/engine/tiles/tiles.md 「통합 방식」 영향 검토
 */
import { BOARD, FORTUNES, SUBMAPS, formatMoney, jobById, type SubmapId, type Tile } from '../../../data/data';
import {
  addFortune, addMoney, applyEffects, gainTreasure,
  type ChoiceResolver, type Ctx, type MsgKind, type Player, type SpinResolver,
} from '../../core/core';
import { promoteOne } from '../../systems/systems';

export function onTravel(ctx: Ctx, p: Player, tile: Tile): void {
  const sub = tile.sub as SubmapId;
  const sm = SUBMAPS[sub];
  ctx.state.pending = {
    type: 'choice', kind: 'travel', playerId: p.id, sub,
    title: `여행 칸! ${sm.name}(으)로 여행을 떠날까요?`,
    options: [
      { label: `✈️ ${sm.name}(으)로 떠난다`, desc: '돌아올 때는 본 맵의 6칸 앞(지름길)으로 돌아온다' },
      { label: '가지 않는다', desc: '그대로 진행' },
    ],
  };
}

export const resolveTravel: ChoiceResolver = (ctx, p, pend, idx) => {
  if (idx !== 0 || !pend.sub) { ctx.msg(p, '여행은 다음 기회에.', 'info'); return; }
  p.subReturn = BOARD.tiles[p.tile].ret ?? null;
  p.tile = BOARD.subStart[pend.sub];
  ctx.msg(p, `✈️ ${SUBMAPS[pend.sub].name}(으)로 여행을 떠났다!`, 'lucky');
  ctx.events.push({ t: 'warp', pid: p.id, tile: p.tile, fly: true });
};

export function onSubTile(ctx: Ctx, p: Player, tile: Tile): void {
  switch (tile.type) {
    case 'rest':
      ctx.msg(p, '🌾 시골에서 푹 쉬었다.', 'lucky');
      applyEffects(ctx, p, { phy: 5, fortune: 1 });
      break;
    case 'farm':
      ctx.msg(p, '🥕 밭에서 수확했다!', 'payday');
      addMoney(ctx, p, 500, '수확');
      break;
    case 'bet':
      ctx.state.pending = {
        type: 'choice', kind: 'bet', playerId: p.id, title: '🎰 베팅! 룰렛 6 이상이면 건 돈의 3배',
        options: [{ label: '1000만 건다', amount: 1000 }, { label: '3000만 건다', amount: 3000 }, { label: '그만둔다', amount: 0 }],
      };
      break;
    case 'dig':
      if (ctx.rnd() < 0.5) { ctx.msg(p, '⛏️ 보물을 캐냈다!', 'lucky'); gainTreasure(ctx, p); }
      else { ctx.msg(p, '⛏️ 허탕... 삽값만 들었다.', 'bad'); addMoney(ctx, p, -200, '허탕'); }
      break;
    case 'jackpot':
      ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'jackpot', title: '💰 잭팟! 룰렛 값 × 1000만' };
      break;
    case 'pray':
      ctx.msg(p, '⛩️ 신에게 봉납하고 기도했다.', 'event');
      addMoney(ctx, p, -300, '봉납');
      ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'pray', title: '🙏 기도 룰렛! 8 이상이면 큰 축복' };
      break;
    case 'omikuji':
      ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'omikuji', title: '🎴 운세 뽑기! 룰렛으로 운세가 새로 정해진다' };
      break;
    case 'return': {
      const back = p.subReturn;
      p.subReturn = null;
      if (back != null) {
        ctx.msg(p, '✈️ 여행을 마치고 돌아왔다! (지름길)', 'lucky');
        p.tile = back;
        ctx.events.push({ t: 'warp', pid: p.id, tile: back, fly: true });
      }
      break;
    }
    default:
      break;
  }
}

export const resolveBetChoice: ChoiceResolver = (ctx, p, pend, idx) => {
  const amount = pend.options[idx].amount ?? 0;
  if (amount) ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'bet', amount, title: `${formatMoney(amount)} 베팅! 6 이상이면 3배` };
  else ctx.msg(p, '베팅은 그만두었다.', 'info');
};

export const resolveBet: SpinResolver = (ctx, p, pend, value) => {
  const amount = pend.amount ?? 0;
  if (value >= 6) { ctx.msg(p, '🎰 대박! 3배!', 'lucky'); addMoney(ctx, p, amount * 2, '베팅 수익'); }
  else { ctx.msg(p, '🎰 꽝...', 'bad'); addMoney(ctx, p, -amount, '베팅 손실'); }
};

export const resolveJackpot: SpinResolver = (ctx, p, _pend, value) => {
  ctx.msg(p, `💰 잭팟 ${value}배!`, 'lucky');
  addMoney(ctx, p, value * 1000, '잭팟');
};

export const resolvePray: SpinResolver = (ctx, p, _pend, value) => {
  if (value >= 8) {
    ctx.msg(p, '✨ 신의 큰 축복!', 'lucky');
    addFortune(ctx, p, 2);
    const job = jobById(p.job);
    if (job && job.type === 'spin' && promoteOne(ctx, p)) ctx.msg(p, `「${job.ranks[p.rank].name}」(으)로 랭크업!`, 'lucky');
  } else if (value >= 4) {
    ctx.msg(p, '작은 축복을 받았다.', 'lucky');
    addFortune(ctx, p, 1);
  } else {
    ctx.msg(p, '아무 일도 일어나지 않았다...', 'info');
  }
};

export const resolveOmikuji: SpinResolver = (ctx, p, _pend, value) => {
  const f = value <= 2 ? 1 : value <= 5 ? 3 : value <= 8 ? 4 : value === 9 ? 5 : 6;
  const kind: MsgKind = f >= 5 ? 'lucky' : f <= 1 ? 'bad' : 'event';
  ctx.msg(p, `🎴 운세 뽑기 결과: 「${FORTUNES[f]}」`, kind);
  addFortune(ctx, p, f - p.fortune);
};
