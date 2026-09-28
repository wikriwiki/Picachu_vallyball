/**
 * @pyramid-spec      design/engine/tiles/tiles.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/tiles/tiles.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { BOARD } from '../../data/data';
import type { Ctx, Player } from '../core/core';
import { onDestinyTile, onLoveTile } from '../systems/systems';
import { onStar, onStar3 } from './star/star';
import { onGhost, onHiyari } from './crisis/crisis';
import { onBaby, onCard, onChallenge, onChoice, onEnd, onGoal, onStop } from './life/life';
import { onSubTile, onTravel } from './travel/travel';

export * from './star/star';
export * from './crisis/crisis';
export * from './life/life';
export * from './travel/travel';

export function resolveTile(ctx: Ctx, p: Player): void {
  const t = BOARD.tiles[p.tile];
  ctx.events.push({ t: 'land', pid: p.id, tile: t.i, type: t.type });
  switch (t.type) {
    case 'star1': case 'star2': onStar(ctx, p, t); break;
    case 'star3': onStar3(ctx, p); break;
    case 'hiyari': onHiyari(ctx, p); break;
    case 'ghost': onGhost(ctx, p); break;
    case 'love': onLoveTile(ctx, p); break;
    case 'destiny': onDestinyTile(ctx, p); break;
    case 'choice': onChoice(ctx, p); break;
    case 'card': onCard(ctx, p); break;
    case 'baby': onBaby(ctx, p); break;
    case 'challenge': onChallenge(ctx, p); break;
    case 'stop': onStop(ctx, p, t); break;
    case 'end': onEnd(ctx, p); break;
    case 'goal': onGoal(ctx, p); break;
    case 'travel': onTravel(ctx, p, t); break;
    case 'substart': case 'rest': case 'farm': case 'bet': case 'dig': case 'jackpot': case 'pray': case 'omikuji': case 'return':
      onSubTile(ctx, p, t); break;
    default: break; // start, payday
  }
}
