---
pyramid: node
id: tiles
title: 칸 규칙
parent: ../engine.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `칸 규칙` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 칸 규칙

## 정의
플레이어가 멈춘 칸의 효과를 판정한다. 칸 종류마다 이벤트 표에서 뽑거나, 추가 룰렛·선택 대기를 만들거나, 연애·직업 시스템에 넘긴다. 칸 효과는 멈춘 칸에만 적용된다 (월급날 통과 지급과 STOP 강제 정지는 이동의 몫).

## 관계
- 분해 축: 종류(kind-of)
- 관계 문장: "행운·위기 칸"은 이벤트 표로 능력치와 돈을 흔들고, "인생 칸"은 선택·카드·아기·찬스·STOP·도착을 처리하며, "여행 칸"은 서브맵 여행과 서브맵 전용 칸을 처리한다. 하트·운명의 하트 칸은 연애 시스템이 맡는다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 행운 칸 | 별 칸 Lv1·Lv2(시대 이벤트, Lv2 좋은 효과 2배, 운세 보정)와 별 칸 Lv3 | [star.md](star/star.md) |
| 위기 칸 | 물방울 칸(문구 + 능력치 변동 룰렛)과 유령 칸(보험 카드 방어, 큰 손해 + 운세 −1) | [crisis.md](crisis/crisis.md) |
| 인생 칸 | 선택 칸(투자 룰렛 포함), 카드 칸, 아기 칸, 랭크업 찬스, STOP(결혼·내 집 마련), END, GOAL | [life.md](life/life.md) |
| 여행 칸 | 여행 칸과 서브맵 칸(출발·휴식·수확·베팅·보물 캐기·잭팟·기도·운세 뽑기·귀환) | [travel.md](travel/travel.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/engine/tiles/tiles.ts`):
  ```ts
  export function resolveTile(ctx: Ctx, p: Player): void;
  // 자식의 판정 함수도 다시 내보낸다
  ```
- 자식에게 요구하는 것: 각 자식은 자기 칸 종류의 처리 함수 `onXxx(ctx, p, tile)` 와, 자기가 만든 대기의 판정 함수를 공개한다.
  - 행운 칸: `onStar(ctx, p, tile)`(star1·star2), `onStar3(ctx, p)`.
  - 위기 칸: `onHiyari(ctx, p)`, `onGhost(ctx, p)`, 판정 `hiyari` 룰렛.
  - 인생 칸: `onChoice`, `onCard`, `onBaby`, `onChallenge`, `onStop(ctx, p, tile)`, `onEnd`, `onGoal`, 판정 `gamble` 룰렛, `event`·`house` 선택.
  - 여행 칸: `onTravel(ctx, p, tile)`, `onSubTile(ctx, p, tile)`(서브맵 칸 전부), 판정 `travel`·`bet` 선택, `bet`·`jackpot`·`pray`·`omikuji` 룰렛.
- 조립: `resolveTile(ctx, p)`:
  1. `t = BOARD.tiles[p.tile]`, 이벤트 `{ t: 'land', pid, tile: t.i, type: t.type }` 를 남긴다.
  2. 종류별로 넘긴다: `star1`·`star2` → `onStar`, `star3` → `onStar3`, `hiyari` → `onHiyari`, `ghost` → `onGhost`, `love` → 연애의 `onLoveTile`, `destiny` → 연애의 `onDestinyTile`, `choice` → `onChoice`, `card` → `onCard`, `baby` → `onBaby`, `challenge` → `onChallenge`, `stop` → `onStop`, `end` → `onEnd`, `goal` → `onGoal`, `travel` → `onTravel`, 서브맵 칸 종류(`substart`·`rest`·`farm`·`bet`·`dig`·`jackpot`·`pray`·`omikuji`·`return`) → `onSubTile`. `start`·`payday` 는 아무것도 하지 않는다.
- 공통 기준 — 시대 묶음 `group(era)`: 아기 `baby`, 초등 `kid`, 중·고 `teen`, 어른 전·후반 `adult`, 마지막 `final` (데이터의 `ERA_GROUP`).

## 수용 기준
- 모든 칸 종류에 대해 `resolveTile` 이 예외 없이 끝난다 (빈 손패·빈 연애 후보·직업 없음 등 극단 상태 포함).
- `resolveTile` 뒤 상태는 JSON 직렬화 가능하고, 플레이어 현금은 0 이상이다.

## 참조
- [data.md](../../data/data.md): `BOARD`, `ERA_GROUP`, 이벤트 문구표, `SUBMAPS`
- [systems.md](../systems/systems.md): 연애의 하트·운명의 하트·결혼 STOP 처리, 직업의 찬스 칸 처리
- [core.md](../core/core.md): `Ctx`, 효과 연산
