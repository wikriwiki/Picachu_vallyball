---
pyramid: node
id: city
title: 도시 장식
parent: ../view.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `도시 장식` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 도시 장식

## 정의
보드 주변을 원작처럼 빽빽한 도시로 꾸민다. 레인 사이 가로 도로·세로 골목길·가장자리 도로, 횡단보도·가로등·달리는 차량, 시대별 랜드마크(병원·학교·예식장·쇼핑몰·온천 등), 마리나와 GOAL 성, 도로를 바라보는 건물과 섬 곳곳의 나무, 서브맵 섬의 전용 장식을 만든다. 모든 배치는 고정 시드(4242)로 결정적이며 게임 규칙과 무관하다.

## 관계
- 분해 축: 구성(part-of)
- 관계 문장: "거리"가 도로와 차량으로 도시의 뼈대를 만들고, "랜드마크"가 시대마다 상징 건물을 놓으며, "채우기"가 남은 땅을 건물과 나무로 메우고, "섬 장식"이 서브맵 섬을 꾸민다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 거리 | 도로(가로·골목·가장자리), 도로 거리 함수, 횡단보도, 가로등, 달리는 차량 14대 | [streets.md](streets/streets.md) |
| 랜드마크 | 시대별 구역 표, 랜드마크 형상 18종, 레인 옆 블록 배치, 마리나, GOAL 성 | [landmarks.md](landmarks/landmarks.md) |
| 채우기 | 도시 블록 건물(상가·집·빌딩·장난감)과 섬 곳곳의 집·나무를 인스턴싱으로 | [fill.md](fill/fill.md) |
| 섬 장식 | 시골 마을(헛간·풍차·밭), 일확천금 섬(카지노·야자수), 신들의 섬(도리이·신사·석등), 둘레 나무 | [islands.md](islands/islands.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/view/city/city.ts`):
  ```ts
  export interface City { update(time: number, dt: number): void; }
  export function buildCity(stage: Stage, env: Environment, board: BoardView): City;
  ```
- 공통 도시 맥락 `CityCtx` (이 node 소유 타입, `src/view/city/city-ctx.ts`): `{ scene, env, board, rng: () => number, occupied: Rect[], updaters: ((t, dt) => void)[], rows, zMin, zMax, roadZs: number[], side: number, tileNear(r, margin?): boolean }`. `Rect = { x0, x1, z0, z1 }`.
- 자식에게 요구하는 것:
  - 거리: `buildStreets(ctx)` 가 도로를 깔고 `roadDist(x, z)` 를 돌려준다. 차량 이동은 `ctx.updaters` 에 등록.
  - 랜드마크: `placeLandmarks(ctx)` 가 구역 표대로 랜드마크·마리나·GOAL 성을 놓고 차지한 영역을 `ctx.occupied` 에 넣는다.
  - 채우기: `fillCity(ctx, roadDist)` 가 비어 있는 곳에 건물·나무를 놓는다. 랜드마크 뒤에 부른다.
  - 섬 장식: `decorateIslands(ctx)`.
  - 난수는 모두 `ctx.rng` 로만 뽑는다 (호출 순서가 결과를 정한다).
- 조립: `rng = createRng(4242)`, `rows = round(본 맵 칸 최대 z / RS) + 1`, `roadZs = [k·RS + RS/2 for k = −1..rows−1]`, `zMin/zMax = roadZs 처음/끝`, `side = ROW/2 + 8 = 38`, `tileNear(r, m=1.9)` = 본 맵 칸 중 r 을 m 만큼 넓힌 사각형 안에 있는 칸이 있는지. 순서: 거리 → 랜드마크 → 채우기 → 섬 장식. `update(t, dt)` 는 `updaters` 를 모두 부른다.

## 수용 기준
- 브라우저에서 도로가 레인 사이와 보드 양옆에 보이고, 차량이 움직이며, 시대마다 랜드마크 두 개(어른 시대는 STOP 옆 건물까지)가 보인다.
- 건물·나무가 보드 칸과 도로 위에 겹치지 않는다.

## 참조
- [stage.md](../stage/stage.md), [environment.md](../environment/environment.md), [board-view.md](../board-view/board-view.md), [toolkit.md](../toolkit/toolkit.md)
- [data.md](../../data/data.md): `BOARD`, `ERAS`, `LAYOUT`, `createRng`
