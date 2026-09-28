/**
 * @pyramid-spec      design/engine/actions/actions.md
 * @pyramid-parent    design/engine/engine.md
 * @pyramid-on-change 1) design/engine/actions/actions.md 먼저 수정 2) 이 코드 수정 3) design/engine/engine.md 「통합 방식」 영향 검토
 */
import { RuleError, type Action, type ChoiceKind, type ChoiceResolver, type Ctx, type Player, type SpinPurpose, type SpinResolver } from '../core/core';

export interface Resolvers {
  spin: Record<SpinPurpose, SpinResolver>;
  choice: Record<ChoiceKind, ChoiceResolver>;
  useCard(ctx: Ctx, p: Player, action: Extract<Action, { type: 'card' }>): void;
}

export function spinValue(power: number, r: number): number {
  const n = Number(power);
  const pw = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  return (Math.floor(pw * 23 + r * 7) % 10) + 1;
}

export function applyInput(ctx: Ctx, playerId: string, action: Action, resolvers: Resolvers): void {
  const s = ctx.state;
  if (s.phase !== 'playing') throw new RuleError('게임이 진행 중이 아닙니다.');
  const pend = s.pending;
  if (!pend || pend.playerId !== playerId) throw new RuleError('지금은 당신의 차례가 아닙니다.');
  const p = ctx.player(playerId);
  switch (action.type) {
    case 'card':
      resolvers.useCard(ctx, p, action);
      return;
    case 'spin': {
      if (pend.type !== 'spin') throw new RuleError('지금은 룰렛을 돌릴 수 없습니다.');
      s.pending = null;
      const value = pend.fixed != null ? pend.fixed : spinValue(action.power, ctx.rnd());
      ctx.events.push({ t: 'spin', pid: p.id, value, purpose: pend.purpose, fixed: pend.fixed != null });
      resolvers.spin[pend.purpose](ctx, p, pend, value);
      return;
    }
    case 'choose': {
      if (pend.type !== 'choice') throw new RuleError('선택할 것이 없습니다.');
      const idx = action.index | 0;
      const opt = pend.options[idx];
      if (!opt) throw new RuleError('잘못된 선택입니다.');
      if (opt.disabled) throw new RuleError('조건을 만족하지 않습니다.');
      s.pending = null;
      ctx.events.push({ t: 'chose', pid: p.id, kind: pend.kind, index: idx, label: opt.label });
      resolvers.choice[pend.kind](ctx, p, pend, idx);
      return;
    }
    default:
      throw new RuleError('알 수 없는 조작입니다.');
  }
}
