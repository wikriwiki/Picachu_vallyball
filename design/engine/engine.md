---
pyramid: node
id: engine
title: 룰 엔진
parent: ../capstone.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생게임 온라인](../capstone.md) 의 「자식 구성요소」 중 `룰 엔진` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 룰 엔진

## 정의
게임의 모든 판정을 맡는 순수 함수 모음이다. 게임 상태와 한 플레이어의 조작을 받아, 입력 상태를 바꾸지 않고 다음 상태와 연출용 이벤트 목록을 돌려준다. 모든 난수는 상태에 저장된 시드에서 뽑으므로, 같은 시드와 같은 조작 순서면 결과가 같다. 서버에서만 판정에 쓰이고, 클라이언트는 타입과 표시용 계산(`salaryOf`)만 가져다 쓴다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "조작 처리"가 플레이어의 조작을 받아 "인생 시스템"과 "칸 규칙"의 판정을 부르고, "진행"이 다음 차례·시대·결과로 게임을 넘기며, 모두 "엔진 코어"의 상태와 효과 연산 위에서 움직인다. "CPU"는 같은 상태를 보고 조작을 고른다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 엔진 코어 | 상태·조작·이벤트 타입, 판정 컨텍스트(난수·이벤트·기록), 돈·능력치·운세·카드·보물 효과 연산 | [core.md](core/core.md) |
| 진행 | 차례 순환, 시대 전환과 시대 시작 선택, 이동과 월급날, 결과 발표 | [flow.md](flow/flow.md) |
| 칸 규칙 | 멈춘 칸의 종류별 효과 (별·물방울·유령·선택·카드·찬스·아기·STOP·여행·서브맵·END·GOAL) | [tiles.md](tiles/tiles.md) |
| 인생 시스템 | 연애·결혼, 직업·승진, 카드 사용 | [systems.md](systems/systems.md) |
| 조작 처리 | 조작 검증, 룰렛 값 계산, 대기 중인 룰렛·선택의 판정 분배 | [actions.md](actions/actions.md) |
| CPU | 대기 중인 룰렛·선택에 대해 CPU·자동 진행용 조작을 고른다 | [cpu.md](cpu/cpu.md) |

## 통합 방식
- 제공 인터페이스 (서버·클라이언트가 쓰는 공개 API, 구현 위치 `src/engine/engine.ts`):
  ```ts
  export type { GameState, PublicState, Player, Pending, Action, GameEvent, Mode, PlayerSeed, GameResult } from './core/core';
  export { RuleError } from './core/core';

  // 새 게임. players 는 1~4명. 시작 직후 첫 대기(pending)까지 진행한 상태를 돌려준다.
  export function createGame(opts: { players: PlayerSeed[]; mode?: Mode; seed: number }):
    { state: GameState; events: GameEvent[] };

  // 조작 적용. 입력 state 는 바꾸지 않는다. 잘못된 조작이면 RuleError 를 던진다.
  // 성공하면 seq 가 1 늘어난 새 상태와 이번 조작으로 생긴 이벤트를 돌려준다.
  export function applyAction(state: GameState, playerId: string, action: Action):
    { state: GameState; events: GameEvent[] };

  // 대기 중인 조작 주체를 대신할 조작. pending 이 없으면 null. rand 는 판정에 쓰이지 않는 의사결정용 난수.
  export function cpuAction(state: GameState, rand?: () => number): Action | null;

  // 클라이언트 전송용 상태 (rng 제외)
  export function publicState(state: GameState): PublicState;

  // 현재 랭크 월급 (직업이 없으면 0)
  export function salaryOf(player: Player): number;
  ```
- 자식에게 요구하는 것:
  - 엔진 코어: 모든 타입과 `RuleError`, `newGameState(opts)`(난수로 연애 후보 ★와 어른 모드 능력치를 정한 초기 상태), `createContext(state): Ctx`(난수 `rnd`·`rint`·`choose`, `events`, `msg`, `log`), 효과 연산 `addMoney`·`addStat`·`addFortune`·`applyEffects`·`gainCard`·`gainTreasure`·`incomeUnit`·`collectFromOthers`·`salaryOf` 를 공개한다. 다른 자식에 의존하지 않는다.
  - 진행: `startGame(ctx)`(시작 시대의 시작 선택을 큐에 넣고 첫 대기까지 진행)와 `advance(ctx)`(대기가 생기거나 게임이 끝날 때까지 큐·차례·시대를 넘김), `doMove(ctx, player, steps, forcedNext?)`, 그리고 자기가 만든 선택(`club`·`career`·`job`·`crush`·`route`)의 판정 함수를 공개한다.
  - 칸 규칙: `resolveTile(ctx, player)` 와 칸 효과가 만든 룰렛·선택(`gamble`·`hiyari`·`bet`·`jackpot`·`pray`·`omikuji` 룰렛, `event`·`travel`·`bet`·`house` 선택)의 판정 함수를 공개한다.
  - 인생 시스템: 연애(`propose` 룰렛·선택, `destiny` 선택), 직업(`rankup` 룰렛, 승진 검사, 랭크업 필요값), 카드(`useCard`)를 공개한다.
  - 조작 처리: `applyInput(ctx, playerId, action, resolvers)`. 조작을 검증하고, 룰렛이면 값을 계산해 `spin` 이벤트를 남긴 뒤 목적별 판정 함수를, 선택이면 `chose` 이벤트를 남긴 뒤 종류별 판정 함수를, 카드면 `useCard` 를 부른다. `advance` 는 부르지 않는다.
  - CPU: `chooseAction(state, rand)`.
  - 판정 함수 형식: 룰렛 `SpinResolver = (ctx, player, pending, value) => void`, 선택 `ChoiceResolver = (ctx, player, pending, index) => void`. 판정 함수는 새 대기를 `ctx.state.pending` 에 둘 수 있다.
- 조립: 구현 위치 `src/engine/engine.ts`.
  1. 각 자식이 공개한 판정 함수를 모아 `resolvers = { spin: Record<SpinPurpose, SpinResolver>, choice: Record<ChoiceKind, ChoiceResolver> }` 를 만든다. 모든 목적·종류가 빠짐없이 들어가야 한다 (타입으로 강제).
  2. `createGame`: `newGameState` → `createContext` → `startGame` → `{ state, events: ctx.events }`.
  3. `applyAction`: `phase` 가 `playing` 이 아니면 RuleError. `structuredClone(state)` 로 복사 → `createContext` → `applyInput` → `advance` → `seq += 1` → `{ state, events }`.
  4. `cpuAction` 은 CPU 의 `chooseAction` 을, `publicState` 는 `rng` 필드만 뺀 얕은 복사를 돌려준다.
- 데이터 흐름: 조작 → 조작 처리 → (판정 함수 → 효과 연산 / 이동 → 칸 규칙 → 효과 연산) → 진행 → 새 상태 + 이벤트

## 수용 기준
- 같은 시드와 같은 조작 순서로 두 번 진행하면 매 단계의 상태와 이벤트가 같다.
- `applyAction` 뒤에도 입력으로 준 상태 객체는 그대로다.
- 세 모드 각각 CPU 4명(`cpuAction` 만 사용)으로 60판씩 진행하면 모두 `phase: 'ended'` 로 끝나고, 도중에 오류가 없으며, 모든 플레이어의 현금은 0 이상이다.
- `kids` 모드는 고등학생 시절이 끝나면 바로 결과 발표가 되고, `adult` 모드는 어른 시절 전반에서 시작한다.
- 결과 발표의 `ranking` 은 총자산 내림차순이고, 각 행의 `total` 은 항목 합과 같다.
- 차례가 아닌 플레이어의 조작, 대기 종류와 맞지 않는 조작, 비활성 선택지는 RuleError 이고 상태는 바뀌지 않는다.

## 참조
- [data.md](../data/data.md): 시대·직업·카드·이벤트 표 등 규칙 데이터, `BOARD`, 시드 난수 알고리즘, `formatMoney`
