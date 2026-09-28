---
pyramid: node
id: flow
title: 진행
parent: ../engine.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `진행` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 진행

## 정의
게임이 흘러가게 하는 규칙이다. 차례를 넘기고 라운드를 세며, 시대의 턴이 다하거나 모두 도착하면 다음 시대로 넘기고 시대 시작 선택(동아리·관심 있는 사람·진로·직업)을 차례로 묻는다. 룰렛 값만큼 보드 그래프를 따라 말을 옮기며 월급날·STOP·귀환 칸·갈림길을 처리하고, 마지막에 결과 발표로 총자산 순위를 매긴다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "차례 순환"이 대기가 없을 때 다음 할 일을 정하고, 시대가 끝나면 "시대 전환"을 부르며, 이동 룰렛이 돌면 "이동"이 말을 옮기고, 마지막 시대가 끝나면 "결과 발표"가 순위를 매긴다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 차례 순환 | 대기 큐 소비, 차례 시작(이동 룰렛 대기), 차례 끝(다음 플레이어·라운드·시대 종료 판정) | [turn.md](turn/turn.md) |
| 시대 전환 | 다음 시대로 이동, 시대 시작 선택 큐, 동아리·진로 선택과 판정 | [era.md](era/era.md) |
| 이동 | 그래프를 따라 한 칸씩 이동, 월급날 지급, STOP·귀환 칸 정지, 갈림길 선택과 판정 | [movement.md](movement/movement.md) |
| 결과 발표 | 현금·보물·집·자녀·GOAL 순위·특별상·약속어음 합산과 순위 | [finish.md](finish/finish.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/engine/flow/flow.ts`, 자식 모듈을 다시 내보냄):
  - `startGame(ctx)`: 시작 시대의 시작 선택을 큐에 넣고 `advance(ctx)`.
  - `advance(ctx)`: 차례 순환의 것.
  - `doMove(ctx, player, steps, forcedNext?)`: 이동의 것.
  - 판정 함수: `club`·`career` 선택(시대 전환), `move` 룰렛과 `route` 선택(이동).
  - `finishGame(ctx)`: 결과 발표의 것 (차례 순환·시대 전환이 부름).
- 자식에게 요구하는 것:
  - 차례 순환: `advance(ctx)` 는 `ctx.state.pending` 이 생기거나 `phase` 가 `playing` 이 아니게 될 때까지 반복한다. 반복이 500번을 넘으면 `Error('advance loop')` 를 던진다. 큐 항목은 시대 전환의 `makeQueued` 로 대기로 바꾼다.
  - 시대 전환: `nextEra(ctx)`, `queueEraStart(ctx)`, `makeQueued(ctx, item): Pending` 을 공개한다. `crush` 선택은 연애 시스템의, `job` 선택은 직업 시스템의 생성 함수를 부른다.
  - 이동: 멈춘 칸의 효과는 칸 규칙의 `resolveTile(ctx, player)` 로 넘긴다. 월급 지급 전 능력치 승진 검사는 직업 시스템을 부른다.
  - 결과 발표: `finishGame(ctx)` 은 `phase = 'ended'`, `pending = null`, `result` 를 채우고 `result` 이벤트를 남긴다.
- 조립: `src/engine/flow/flow.ts` 는 네 자식을 다시 내보내고, `startGame` 만 직접 정의한다 (`queueEraStart(ctx)` → `advance(ctx)`).

## 수용 기준
- `full` 모드 1인 게임을 CPU 조작으로 진행하면 시대 0→6 을 순서대로 지나고, GOAL 도착 후 `phase: 'ended'` 가 된다.
- 시대가 바뀔 때마다 모든 플레이어가 그 시대의 START 칸으로 옮겨지고 `era` 이벤트가 한 번 남는다.
- 중학생·고등학생 시대 시작에는 플레이어마다 동아리 선택이, 고등학생 시작에는 상대가 없는 플레이어에게 관심 있는 사람 선택이, 어른 전반 시작에는 진로 → 직업 선택이 순서대로 온다.

## 참조
- [data.md](../../data/data.md): `ERAS`, `BOARD`, `CLUBS`, 경제 상수
- [tiles.md](../tiles/tiles.md): `resolveTile`
- [systems.md](../systems/systems.md): 연애의 관심 있는 사람 선택, 직업의 직업 선택·승진 검사
