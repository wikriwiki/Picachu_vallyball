---
pyramid: leaf
id: turn
title: 차례 순환
parent: ../flow.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [진행](../flow.md) 의 「자식 구성요소」 중 `차례 순환` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 차례 순환

## 정의
대기가 없을 때 게임을 앞으로 미는 순환이다. 큐에 쌓인 시대 시작 선택이 있으면 그것을 대기로 만들고, 차례가 진행 중이 아니면 새 차례를 시작해 이동 룰렛을 기다리며, 차례가 끝났으면 다음 플레이어로 넘기고 라운드와 시대 종료를 판정한다.

## 인터페이스
- 구현 위치: `src/engine/flow/turn/turn.ts`, 테스트 `src/engine/flow/turn/turn.test.ts`
- 공개 API:
  ```ts
  export function advance(ctx: Ctx): void;
  export function beginTurn(ctx: Ctx): void;
  export function endTurn(ctx: Ctx): void;
  ```

## 동작 규칙
1. `advance`: `state.pending` 이 없고 `phase === 'playing'` 인 동안 반복 (500번 넘으면 `Error('advance loop')`):
   - 큐가 있으면 맨 앞을 꺼내 `state.pending = makeQueued(ctx, 항목)`.
   - 아니면 `turnActive` 면 `endTurn`, 아니면 `beginTurn`.
2. `beginTurn`: `p = players[turn]`, `turnActive = true`, `p.cardUsed = false`. 마지막 시대면 `p.finished`, 아니면 `p.doneEra` 가 true 인 플레이어는 여기서 끝 (차례를 건너뜀). 아니면 이벤트 `turn {pid, era, round}`, 대기 `{ type:'spin', playerId, purpose:'move', title:'룰렛을 돌리세요!' }`.
3. `endTurn`: `turnActive = false`, `turn = (turn + 1) % 인원`, turn 이 0 이 되면 `round += 1`.
   - 마지막 시대: 모두 `finished` 면 `finishGame`. 그 외 끝.
   - 그 외 시대: `turn === 0` 이고 (`round ≥ era.turns` 또는 모두 `doneEra`) 이면 `nextEra`. 아니면 모두 `doneEra` 면 `turn = 0` 으로 두고 `nextEra` (라운드 도중 전원 도착).

## 경계 조건
- 모든 플레이어가 차례를 건너뛰는 상태(모두 finished 이지만 아직 결과 전)는 endTurn 에서 결과 발표로 끝난다.
- 1인 게임에서도 매 차례 뒤 turn 이 0 이 되어 round 가 늘어난다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 새 1인 상태(대기 없음) | `advance` | turn 이벤트, move 룰렛 대기, turnActive true |
| 2 | 큐에 club 항목 | `advance` | club 선택 대기, 큐 비어 있음 |
| 3 | 2인, 시대 0(turns 2), round 1, turn 1, turnActive | `endTurn` | turn 0, round 2, era 1 로 넘어감 |
| 4 | 2인, 시대 1, round 0, turn 0, p1 doneEra, p2 doneEra, turnActive | `endTurn` | turn 0 으로 두고 era 2 |
| 5 | 2인, p1 doneEra | turn 0 에서 `advance` | p1 은 건너뛰고 p2 의 turn 이벤트 |
| 6 | 마지막 시대, 모두 finished, turnActive | `endTurn` | phase ended |

## 참조
- [era.md](../era/era.md): `nextEra`, `makeQueued`
- [finish.md](../finish/finish.md): `finishGame`
- [core.md](../../core/core.md): `Ctx`
- [data.md](../../../data/data.md): `ERAS`, `FINAL_ERA`
