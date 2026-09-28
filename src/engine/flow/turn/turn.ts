/**
 * @pyramid-spec      design/engine/flow/turn/turn.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/turn/turn.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { ERAS, FINAL_ERA } from '../../../data/data';
import type { Ctx } from '../../core/core';
import { makeQueued, nextEra } from '../era/era';
import { finishGame } from '../finish/finish';

export function advance(ctx: Ctx): void {
  const s = ctx.state;
  let guard = 0;
  while (!s.pending && s.phase === 'playing') {
    if (++guard > 500) throw new Error('advance loop');
    const q = s.queue.shift();
    if (q) { s.pending = makeQueued(ctx, q); continue; }
    if (s.turnActive) endTurn(ctx);
    else beginTurn(ctx);
  }
}

export function beginTurn(ctx: Ctx): void {
  const s = ctx.state;
  const p = s.players[s.turn];
  s.turnActive = true;
  p.cardUsed = false;
  const skip = s.era === FINAL_ERA ? p.finished : p.doneEra;
  if (skip) return;
  ctx.events.push({ t: 'turn', pid: p.id, era: s.era, round: s.round });
  s.pending = { type: 'spin', playerId: p.id, purpose: 'move', title: '룰렛을 돌리세요!' };
}

export function endTurn(ctx: Ctx): void {
  const s = ctx.state;
  s.turnActive = false;
  s.turn = (s.turn + 1) % s.players.length;
  if (s.turn === 0) s.round += 1;
  if (s.era === FINAL_ERA) {
    if (s.players.every((p) => p.finished)) finishGame(ctx);
    return;
  }
  const era = ERAS[s.era];
  const allDone = s.players.every((p) => p.doneEra);
  if (s.turn === 0 && ((era.turns != null && s.round >= era.turns) || allDone)) {
    nextEra(ctx);
  } else if (allDone) {
    s.turn = 0;
    nextEra(ctx);
  }
}
