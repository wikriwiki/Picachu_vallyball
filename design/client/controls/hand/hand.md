---
pyramid: leaf
id: hand
title: 손패
parent: ../controls.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [입력](../controls.md) 의 「자식 구성요소」 중 `손패` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 손패

## 정의
내 카드 손패다. 가진 카드를 이름·설명과 함께 보여 주고, 지금 쓸 수 있는 카드(내 이동 룰렛 전, 이번 차례 미사용, 보험 아님, 승진 카드는 직업 있을 때)만 누를 수 있다. 지정 룰렛 카드는 1~10 숫자 창에서 고른 뒤 보낸다.

## 인터페이스
- 구현 위치: `src/client/controls/hand/hand.ts`, 테스트 `src/client/controls/hand/hand.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function canUseCard(me: Player, p: Pending | null, card: CardId): boolean;
  export function initHand(ctx: ClientCtx, send: (a: Action) => void): { update(p: Pending | null): void };
  ```

## 동작 규칙
1. `canUseCard(me, p, card)`: p 가 룰렛·이동이고 `!me.cardUsed` 이고 카드 타이밍이 passive 가 아니고 (adultOnly 면 직업이 있을 때) true.
2. `update(p)`: 상태가 없거나 내 플레이어가 없으면 `#hand` 를 비운다. 아니면 손패 카드마다 `div.card`(쓸 수 없으면 `disabled` 추가) 안에 `div.cn` 이름과 설명. 쓸 수 있는 카드를 누르면: 지정 룰렛이면 숫자 창을 연다, 아니면 `send({type:'card', index})`.
3. 숫자 창: `#num-grid` 에 1~10 버튼(`btn`), 누르면 창을 닫고 `send({type:'card', index, number})`. `#num-cancel` 은 창을 닫는다. `#modal-number` 를 보인다.

## 경계 조건
- 손패가 비면 `#hand` 는 비어 있다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 이동 대기, cardUsed false | `canUseCard('double')`, `('insurance')` | true, false |
| 2 | 직업 없음 | `canUseCard('rankup')` | false |
| 3 | 선택 대기 | `canUseCard('charm')` | false |
| 4 | 손패 [charm, fixed], 이동 대기 | `update` 후 charm 클릭 | send `{type:'card', index:0}` |
| 5 | 4 와 같음 | fixed 클릭 → 7 클릭 | send `{type:'card', index:1, number:7}`, 숫자 창 닫힘 |

## 참조
- [data.md](../../../data/data.md): `CARDS`, `CardId`
- [engine.md](../../../engine/engine.md): `Player`, `Pending`, `Action`
