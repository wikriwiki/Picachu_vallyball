---
pyramid: leaf
id: actions
title: 조작 처리
parent: ../engine.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `조작 처리` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 조작 처리

## 정의
플레이어가 보낸 조작 하나를 검증하고 알맞은 판정 함수에 넘긴다. 룰렛 조작이면 힘(power)과 시드 난수로 룰렛 값을 정하고, 선택 조작이면 고른 선택지를 확인하며, 카드 조작이면 카드 시스템에 맡긴다. 차례 넘기기(`advance`)는 하지 않는다.

## 인터페이스
- 구현 위치: `src/engine/actions/actions.ts`, 테스트 `src/engine/actions/actions.test.ts`
- 형태: 순수 함수 (컨텍스트의 상태를 바꿈)
- 공개 API:
  ```ts
  import type { Ctx, Action, SpinPurpose, ChoiceKind, SpinResolver, ChoiceResolver } from '../core/core';
  export interface Resolvers {
    spin: Record<SpinPurpose, SpinResolver>;
    choice: Record<ChoiceKind, ChoiceResolver>;
    useCard(ctx: Ctx, p: Player, action: Extract<Action, { type: 'card' }>): void;
  }
  export function spinValue(power: number, r: number): number;
  export function applyInput(ctx: Ctx, playerId: string, action: Action, resolvers: Resolvers): void;
  ```

## 동작 규칙
1. `spinValue(power, r)`: `pw` = power 를 수로 바꿔 0~1 로 자른 값(수가 아니면 0). 결과 = `(floor(pw × 23 + r × 7) mod 10) + 1`. r 은 [0,1).
2. `applyInput`: `ctx.state.phase !== 'playing'` 이면 `RuleError('게임이 진행 중이 아닙니다.')`.
3. 대기 `pend = ctx.state.pending` 이 없거나 `pend.playerId !== playerId` 면 `RuleError('지금은 당신의 차례가 아닙니다.')`.
4. `action.type === 'card'`: `resolvers.useCard(ctx, p, action)`.
5. `action.type === 'spin'`: `pend.type !== 'spin'` 이면 `RuleError('지금은 룰렛을 돌릴 수 없습니다.')`. `ctx.state.pending = null`. 값 = `pend.fixed` 가 있으면 그 값(난수 미사용), 아니면 `spinValue(action.power, ctx.rnd())`. 이벤트 `{ t:'spin', pid, value, purpose: pend.purpose, fixed: pend.fixed != null }` 를 남기고 `resolvers.spin[pend.purpose](ctx, p, pend, value)`.
6. `action.type === 'choose'`: `pend.type !== 'choice'` 면 `RuleError('선택할 것이 없습니다.')`. `idx = action.index | 0`. `pend.options[idx]` 가 없으면 `RuleError('잘못된 선택입니다.')`, `disabled` 면 `RuleError('조건을 만족하지 않습니다.')`. `ctx.state.pending = null`, 이벤트 `{ t:'chose', pid, kind: pend.kind, index: idx, label }`, `resolvers.choice[pend.kind](ctx, p, pend, idx)`.
7. 그 외 `type` 은 `RuleError('알 수 없는 조작입니다.')`.

## 경계 조건
- 오류를 던질 때는 상태를 바꾸기 전이어야 한다 (난수도 뽑지 않는다).
- power 가 1 보다 크거나 음수여도 0~1 로 잘린다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `spinValue(0, 0)`, `spinValue(0, 0.999)`, `spinValue(1, 0)`, `spinValue(1, 0.999)` | 1, 7, 4, 10 |
| 2 | — | `spinValue(5, 0)`, `spinValue(NaN, 0)` | 4, 1 |
| 3 | 대기 없음 | `applyInput(spin)` | RuleError 차례 아님 |
| 4 | 대기 choice | `applyInput(spin)` | RuleError 룰렛 불가, rng 그대로 |
| 5 | 대기 spin fixed 7, purpose move | `applyInput(spin power 0)` | spin 이벤트 value 7 fixed true, move 판정에 7 전달, rng 그대로 |
| 6 | 대기 choice 옵션 2개 중 1번 disabled | `choose 1` / `choose 5` | 조건 불만족 / 잘못된 선택 |
| 7 | 대기 choice | `choose 0` | chose 이벤트, 해당 kind 판정 1회, pending null 로 호출됨 |
| 8 | phase ended | 아무 조작 | RuleError 진행 중 아님 |

## 참조
- [core.md](../core/core.md): `Ctx`, 타입, `RuleError`
