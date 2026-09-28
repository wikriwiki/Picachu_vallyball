---
pyramid: leaf
id: life
title: 인생 칸
parent: ../tiles.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [칸 규칙](../tiles.md) 의 「자식 구성요소」 중 `인생 칸` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 인생 칸

## 정의
인생의 사건 칸을 처리한다. 선택 칸(시대별 선택지, 투자면 추가 룰렛), 카드 칸(카드 1장), 아기 칸(기혼이면 출산과 축하금, 미혼이면 조카 선물), 랭크업 찬스 칸(직업 시스템에 넘김), STOP 칸(결혼은 연애 시스템, 내 집 마련은 집 선택), 시대 END(도착 후 대기), GOAL(도착 순서 기록)을 맡는다.

## 인터페이스
- 구현 위치: `src/engine/tiles/life/life.ts`, 테스트 `src/engine/tiles/life/life.test.ts`
- 공개 API:
  ```ts
  export function onChoice(ctx: Ctx, p: Player): void;
  export function onCard(ctx: Ctx, p: Player): void;
  export function onBaby(ctx: Ctx, p: Player): void;
  export function onChallenge(ctx: Ctx, p: Player): void;
  export function onStop(ctx: Ctx, p: Player, tile: Tile): void;
  export function onEnd(ctx: Ctx, p: Player): void;
  export function onGoal(ctx: Ctx, p: Player): void;
  export const resolveEvent: ChoiceResolver;   // kind 'event'
  export const resolveHouse: ChoiceResolver;   // kind 'house'
  export const resolveGamble: SpinResolver;    // purpose 'gamble'
  ```

## 동작 규칙
1. `onChoice`: 표 = 묶음 baby·kid → `CHOICES.kid`, teen → `teen`, final → `final`, adult → `adult`. `c = choose(표)`. 대기 `{ type:'choice', kind:'event', playerId, title: c.t, options: c.o 의 {label: l, effect: e} }`.
2. `resolveEvent(p, pend, idx)`: 메시지 "「{label}」"(event), `applyEffects(options[idx].effect)`.
3. `resolveGamble(p, pend, v)`: v ≥ 5 면 메시지 "투자 대성공! 3배가 되었다!"(lucky) + `addMoney(amount × 2, '투자 수익')`, 아니면 "투자 실패... 돈을 잃었다."(bad) + `addMoney(−amount, '투자 손실')`.
4. `onCard`: 메시지 "카드 칸! 카드를 1장 받았다."(card), `gainCard`.
5. `onBaby`: 기혼이면 `name = choose(KID_NAMES)`, 자녀 추가, 이벤트 `kid {pid, name, count}`, 메시지 "아기 「{name}」(이)가 태어났다! 모두에게서 축하금을 받는다."(love), `collectFromOthers(BIRTH_GIFT 100, '출산 축하금')`. 미혼이면 메시지 "조카가 태어났다! 선물을 샀다."(event), `addMoney(−100, '선물')`, `addFortune(1)`.
6. `onChallenge`: 직업 시스템의 `onChallengeTile(ctx, p)`.
7. `onStop`: `tile.stop === 'marriage'` 면 연애 시스템의 `onMarriageStop`. `'house'` 면 대기 `{ type:'choice', kind:'house', playerId, title:'내 집 마련 STOP! 집을 살까요? (결과 발표에서 감정)', options: HOUSES 의 {label: name, desc: formatMoney(price), houseId} + {label:'사지 않는다', desc:'현금을 지킨다'} }`.
8. `resolveHouse(p, pend, idx)`: 선택지에 houseId 가 있으면 집 `{id, name, price}` 추가, 메시지 "「{name}」를 샀다!"(lucky), `addMoney(−price, '주택 구입')`, 이벤트 `house {pid, house: id}`. 없으면 메시지 "집은 사지 않기로 했다."(info).
9. `onEnd`: `doneEra = true`, 메시지 "{시대 이름} 도착! 다른 사람을 기다린다."(info).
10. `onGoal`: `finished = true`, `finishOrder = finishCount++`, 이벤트 `goal {pid, order}`, 메시지 "{order+1}등으로 GOAL!"(lucky).

## 경계 조건
- 현금이 모자라도 집을 살 수 있다 (약속어음 발행).
- 기혼자의 출산 축하금은 다른 플레이어가 0 명이면 없다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 어른 | `onChoice` | kind event 대기, 선택지 2~3개, 각 effect |
| 2 | 대기 `{effect:{int:5}}` | `resolveEvent(0)` | int +5 |
| 3 | amount 1000 | `resolveGamble(5)` / `(4)` | +2000 / −1000 |
| 4 | 기혼, 다른 1명 | `onBaby` | 자녀 1, kid 이벤트, +100/−100 |
| 5 | 미혼 | `onBaby` | −100, 운세 +1 |
| 6 | house STOP | `onStop` | 선택지 5개 (집 4 + 사지 않음) |
| 7 | 현금 1000 | `resolveHouse(0)` | 집 1, 어음 2장, house 이벤트 |
| 8 | finishCount 1 | `onGoal` | finishOrder 1, finishCount 2, "2등으로 GOAL!" |

## 참조
- [systems.md](../../systems/systems.md): `onChallengeTile`, `onMarriageStop`
- [core.md](../../core/core.md): 효과 연산
- [data.md](../../../data/data.md): `CHOICES`, `KID_NAMES`, `HOUSES`, `BIRTH_GIFT`, `ERAS`, `ERA_GROUP`, `formatMoney`, `Tile`
