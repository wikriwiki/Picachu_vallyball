---
pyramid: leaf
id: cards
title: 카드
parent: ../systems.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생 시스템](../systems.md) 의 「자식 구성요소」 중 `카드` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 카드

## 정의
카드 사용 규칙이다. 카드는 이동 룰렛을 돌리기 전에만, 한 차례에 한 장 쓸 수 있다. 지정 룰렛·더블 카드는 이번 이동 룰렛을 바꾸고, 나머지 즉시 카드는 곧바로 효과를 낸다. 보험 카드는 수동으로 쓸 수 없고, 승진 카드는 직업이 있어야 쓴다.

## 인터페이스
- 구현 위치: `src/engine/systems/cards/cards.ts`, 테스트 `src/engine/systems/cards/cards.test.ts`
- 공개 API:
  ```ts
  export function useCard(ctx: Ctx, p: Player, action: { type: 'card'; index: number; number?: number }): void;
  ```

## 동작 규칙
1. 대기가 이동 룰렛(`spin`, `move`)이 아니면 `RuleError('카드는 이동 룰렛 전에만 사용할 수 있습니다.')`. `cardUsed` 면 `RuleError('카드는 한 턴에 1장만 사용할 수 있습니다.')`.
2. `idx = action.index | 0`, 카드 없으면 `RuleError('카드가 없습니다.')`. 보험(`passive`)이면 `RuleError('보험 카드는 자동으로 발동합니다.')`. 승진 카드인데 직업이 없으면 `RuleError('직업이 있어야 사용할 수 있습니다.')`.
3. 지정 룰렛(`fixed`): `n = action.number | 0` 이 1~10 이 아니면 `RuleError('1~10 사이 숫자를 고르세요.')`. 대기에 `fixed = n`, `title = "지정 룰렛: {n}"`.
4. 모든 검사를 통과하면: 손패에서 idx 카드를 빼고, `cardUsed = true`, 이벤트 `card {pid, card, used:true}`, 기록 "{이름}: {카드 이름} 사용".
5. 카드별 효과: `double` → 대기 `double = true`, `title = '더블 카드: 결과 ×2'`. `bonus` → `addMoney(incomeUnit, '보너스')`. `study`/`gym`/`artclass` → int/phy/sen +10. `charm` → 운세 +1. `steal` → 나를 뺀 플레이어 중 현금이 가장 많은 사람(같으면 앞선 순서) o 에게서 `amt = min(500, o.money)`, amt > 0 이면 `addMoney(o, −amt, '가로채기 당함')`, `addMoney(p, amt, '가로채기')`, 메시지 "{o.name}에게서 {formatMoney(amt)}을 가로챘다!"(card) (다른 사람이 없으면 효과 없음). `rankup` → 직업의 `promoteOne` 이 true 면 메시지 "승진 카드! 「{랭크 이름}」(으)로!"(lucky).

## 경계 조건
- 오류를 던지는 경우 손패·상태는 바뀌지 않는다.
- 최고 랭크에서 승진 카드를 쓰면 카드는 소모되고 효과는 없다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 선택 대기 | 카드 사용 | RuleError 이동 룰렛 전에만 |
| 2 | cardUsed | 사용 | RuleError 한 턴에 1장 |
| 3 | 손패 [insurance] | index 0 | RuleError 자동 발동 |
| 4 | 손패 [fixed] | number 11 / 7 | RuleError / 대기 fixed 7, 손패 비움 |
| 5 | 손패 [double] | 사용 | 대기 double true |
| 6 | 손패 [steal], 다른 2명 현금 300, 800 | 사용 | 800 인 사람에게서 500 |
| 7 | 손패 [rankup], 직업 없음 | 사용 | RuleError |
| 8 | 손패 [study] | 사용 | int +10, cardUsed |

## 참조
- [career.md](../career/career.md): `promoteOne`
- [core.md](../../core/core.md): 효과 연산, `RuleError`
- [data.md](../../../data/data.md): `CARDS`, `jobById`, `formatMoney`
