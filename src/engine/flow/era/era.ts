/**
 * @pyramid-spec      design/engine/flow/era/era.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/era/era.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { BOARD, CAREER_OPTIONS, CLUBS, ERAS, FINAL_ERA } from '../../../data/data';
import { addMoney, applyEffects, type ChoiceResolver, type Ctx, type Pending, type QueuedChoice } from '../../core/core';
import { makeCrushChoice, makeJobChoice } from '../../systems/systems';
import { finishGame } from '../finish/finish';

export function nextEra(ctx: Ctx): void {
  const s = ctx.state;
  if (s.mode === 'kids' && s.era === 3) { finishGame(ctx); return; }
  s.era += 1;
  s.round = 0;
  s.turn = 0;
  const start = BOARD.eraStart[s.era];
  ctx.events.push({ t: 'era', era: s.era, name: ERAS[s.era].name });
  ctx.log(`━━ ${ERAS[s.era].name} ━━`);
  for (const p of s.players) {
    p.tile = start;
    p.doneEra = false;
    p.subReturn = null;
    ctx.events.push({ t: 'warp', pid: p.id, tile: start });
  }
  queueEraStart(ctx);
  if (s.era === FINAL_ERA) {
    for (const p of s.players) ctx.msg(p, '은퇴! 이제부터 연금 생활이다. (월급날에 월급의 30%)');
  }
}

export function queueEraStart(ctx: Ctx): void {
  const s = ctx.state;
  const id = ERAS[s.era].id;
  for (const p of s.players) {
    if (id === 'middle' || id === 'high') s.queue.push({ kind: 'club', playerId: p.id });
    if (id === 'high' && !p.partner) s.queue.push({ kind: 'crush', playerId: p.id });
    if (id === 'adult1') {
      s.queue.push({ kind: 'career', playerId: p.id });
      s.queue.push({ kind: 'job', playerId: p.id });
    }
  }
}

export function makeQueued(ctx: Ctx, item: QueuedChoice): Pending {
  const p = ctx.player(item.playerId);
  switch (item.kind) {
    case 'club':
      return {
        type: 'choice', kind: 'club', playerId: p.id, title: `${ERAS[ctx.state.era].name} — 동아리를 고르세요`,
        options: CLUBS.map((c) => ({ label: c.name, desc: c.desc })),
      };
    case 'career':
      return {
        type: 'choice', kind: 'career', playerId: p.id, title: '고등학교 졸업! 진로를 고르세요',
        options: CAREER_OPTIONS.map((o) => ({ label: o.label, desc: o.desc })),
      };
    case 'job':
      return makeJobChoice(ctx, p);
    case 'crush':
      return makeCrushChoice(ctx, p);
  }
}

export const resolveClub: ChoiceResolver = (ctx, p, _pend, idx) => {
  const c = CLUBS[idx];
  p.club = c.id;
  ctx.msg(p, `「${c.name}」에 들어갔다!`, 'event');
  applyEffects(ctx, p, c.eff);
};

export const resolveCareer: ChoiceResolver = (ctx, p, _pend, idx) => {
  if (idx === 0) {
    p.college = true;
    ctx.msg(p, '대학에 진학했다!', 'event');
    addMoney(ctx, p, -800, '학비');
    applyEffects(ctx, p, { int: 12, sen: 4 });
  } else {
    ctx.msg(p, '바로 사회로 뛰어들었다!', 'event');
    applyEffects(ctx, p, { money: 300, phy: 5 });
  }
};
