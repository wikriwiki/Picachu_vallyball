---
pyramid: leaf
id: finish
title: 결과 발표
parent: ../flow.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [진행](../flow.md) 의 「자식 구성요소」 중 `결과 발표` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 결과 발표

## 정의
게임을 끝내고 결과 발표를 계산한다. 플레이어마다 현금, 보물 감정(자동 룰렛 배율), 집 감정, 자녀 효도, GOAL 순위 보너스, 약속어음 상환을 항목으로 만들고, 특별상 6종을 최댓값 보유자에게 준 뒤, 총자산 순으로 순위를 매긴다.

## 인터페이스
- 구현 위치: `src/engine/flow/finish/finish.ts`, 테스트 `src/engine/flow/finish/finish.test.ts`
- 공개 API:
  ```ts
  export function finishGame(ctx: Ctx): void;
  export const AWARDS: readonly { name: string; value(p: Player): number }[];
  ```

## 동작 규칙
1. `phase = 'ended'`, `pending = null`.
2. 플레이어 순서대로 항목:
   - `{ label:'현금', amount: money }`
   - 보물마다 `v = 1 + rint(10)`, `mult = TREASURE_MULT[v−1]`, `{ label: "보물 감정 「{name}」 (룰렛 {v} → ×{mult})", amount: round(base × mult) }`
   - 집마다 `v = 1 + rint(10)`, `mult = 0.7 + 0.1v`, `{ label: "집 감정 「{name}」 (룰렛 {v} → ×{mult 소수 첫째 자리})", amount: round(price × mult) }`
   - 자녀가 있으면 `{ label: "자녀 {n}명의 효도 선물", amount: n × 1000 }`
   - `finishOrder` 가 있고 `GOAL_BONUS[order]` 가 있으면 `{ label: "GOAL {order+1}등 보너스", amount }` (어린이 모드는 finishOrder 가 없으므로 없음)
   - 어음이 있으면 `{ label: "약속어음 {n}장 상환", amount: −n × 1200 }`
3. 특별상 `AWARDS` (순서대로): 최고 연봉상(`salaryOf`), 대가족상(자녀 수), 박사상 (지력 최고)(int), 철인상 (체력 최고)(phy), 아티스트상 (센스 최고)(sen), 행운상 (운세 최고)(fortune). 각 상의 최댓값이 0 이하면 시상 없음. 2인 이상이고 전원이 최댓값이면 시상 없음. 그 외 최댓값인 모두에게 `{ label: "특별상: {name}", amount: 3000 }`.
4. `total` = 항목 합. `ranking` = total 내림차순의 pid (같으면 플레이어 순서 유지).
5. `state.result = { rows, ranking }`, 이벤트 `result {result}`, 기록 "━━ 결과 발표 ━━".

## 경계 조건
- 보물·집 감정 난수는 플레이어 순서, 보물 → 집 순서로 뽑는다.
- 1인 게임은 모든 특별상의 최댓값 보유자가 본인이므로 (값 > 0 이면) 받는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 2인, A 현금 5000 어음 2 / B 현금 1000 자녀 1 | `finishGame` | A 항목 현금·어음 −2400, B 항목 현금·자녀 1000, 대가족상 B |
| 2 | 2인 지력 동점 30 | `finishGame` | 박사상 없음 |
| 3 | 3인 지력 30, 30, 10 | `finishGame` | 박사상 2명 |
| 4 | 보물 1개 base 1000 | `finishGame` | 보물 항목 amount 가 1000 × 배율 중 하나 |
| 5 | 결과 | 각 행 | total = 항목 합, ranking 은 total 내림차순 |
| 6 | 호출 후 | 상태 | phase ended, pending null, result 이벤트 |

## 참조
- [core.md](../../core/core.md): `salaryOf`, `Ctx`
- [data.md](../../../data/data.md): `TREASURE_MULT`, `KID_GIFT`, `GOAL_BONUS`, `NOTE_REPAY`, `AWARD_BONUS`
