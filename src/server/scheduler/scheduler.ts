/**
 * @pyramid-spec      design/server/scheduler/scheduler.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/scheduler/scheduler.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import type { GameEvent } from '../../engine/engine';

export type ActorKind = 'cpu' | 'human' | 'offline';
export interface DelayOptions { delayScale: number; turnTimeout: number; disconnectedDelay: number; }

export function estimateMs(events: readonly GameEvent[]): number {
  let ms = 400;
  for (const e of events) {
    switch (e.t) {
      case 'spin': ms += e.auto ? 1400 : 2800; break;
      case 'move': ms += e.path.length * 280 + 200; break;
      case 'msg': ms += 1300; break;
      case 'era': ms += 2600; break;
      case 'warp': ms += e.fly ? 2600 : 900; break;
      case 'marry': case 'kid': case 'goal': ms += 1500; break;
      case 'result': ms += 4000; break;
      default: ms += 60;
    }
  }
  return Math.min(ms, 20000);
}

export function delayFor(kind: ActorKind, events: readonly GameEvent[], opts: DelayOptions): number {
  const anim = estimateMs(events) * opts.delayScale;
  if (kind === 'cpu') return anim + 700 * opts.delayScale;
  if (kind === 'offline') return anim + opts.disconnectedDelay;
  return anim + opts.turnTimeout;
}
