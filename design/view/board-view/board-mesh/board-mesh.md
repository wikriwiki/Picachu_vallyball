---
pyramid: leaf
id: board-mesh
title: 보드 메시
parent: ../board-view.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [보드 표현](../board-view.md) 의 「자식 구성요소」 중 `보드 메시` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 보드 메시

## 정의
보드를 장면에 놓는다. 칸마다 위치와 방향을 계산하고, 길 색 받침 띠(칸 받침 + 이웃 칸 사이 연결), 둥근 사각 칸 428개를 인스턴싱 메시 하나로, 시대 시작 아치와 이름표, STOP 이름표, GOAL 금색 아치, 분기점 파란 화살표(위아래로 떠다님)를 만든다.

## 인터페이스
- 구현 위치: `src/view/board-view/board-mesh/board-mesh.ts`, 테스트 `src/view/board-view/board-mesh/board-mesh.test.ts`
- 공개 API:
  ```ts
  export const TILE_Y = 0.32;
  export const ROUTE_COLOR: Readonly<Record<RouteId | 'sub', number>>; // main 0xffe27a, love 0xff9ec8, career 0xffb05c, study 0x9cc9ff, sub 0xfff1c9
  export function tileHeadings(tiles: readonly Tile[]): number[];
  export function tileColor(t: Tile): number;
  export function tileGlow(t: Tile): 0 | 1 | 2;
  export function buildBoardMesh(stage: Stage, atlas: ReturnType<typeof makeIconAtlas>): BoardView;
  ```

## 동작 규칙
1. `tileHeadings`: 칸마다 앞 칸 prev(자신을 next 로 가진 첫 칸)를 구한다. next 가 있으면 `atan2(next0.x − t.x, next0.z − t.z)`, 없고 prev 가 있으면 `atan2(t.x − prev.x, t.z − prev.z)`, 둘 다 없으면 0.
2. `tileColor(t)`: 본 맵 start 면 그 시대 color, end·goal 은 흰색, 그 외 `TILE_INFO[type].color`.
3. `tileGlow(t)`: star3 → 1, destiny → 2, 그 외 0.
4. `tilePos[i] = (x, TILE_Y, z)`.
5. 길 띠: 칸마다 받침 `{x, z, w 3.5, d 3.5, 색 ROUTE_COLOR[route]}`, 그리고 next 칸 u 마다 `{중점, w |Δx|+1.6, d |Δz|+1.6, 색 = t 가 main 이면 u 의 route 색, 아니면 t 의 route 색}`. 높이 0.16 박스 인스턴싱, `toonMaterial(흰색, {rim 0.05, specular 0})`, 그림자 받음.
6. 칸: 반폭 1.3, 모서리 0.38 둥근 사각형을 두께 0.36(베벨 0.1) 돌출해 눕힌 형상, `tileMaterial(atlas)` (`uTopY` 0.46). 인스턴스 속성 aIcon(atlas.index), aIndex, aColor(tileColor), aGlow(tileGlow). 칸 방향으로 회전, STOP·GOAL 은 1.2배, 위치 y 0.02. 절두체 컬링 끔.
7. 시대 아치: 시대 START 칸 위치·방향에 기둥 2개(반지름 0.22~0.26, 높이 4.2, 시대색, x ±2.4) + 흰 들보(5.6×0.7×0.5, y 4.3) + 이름표 `textSprite(시대 이름, {bg 시대색, color '#2a2238', size 56, scale 0.9})` y 5.6.
8. STOP 이름표: 결혼 '💒 결혼 STOP', 집 '🏠 내 집 마련 STOP', `{bg '#e03131', size 44, scale 0.9}`, 칸 위 3.2.
9. GOAL 아치: 마지막 END 칸에 금색(0xffd43b) 기둥 2개(x ±3, 높이 6) + 반원 토러스(반지름 3, y 6) + 'GOAL!' 이름표(`{bg '#ffd43b', color '#8a4b00', size 72, scale 1.8}`, y 10), 칸 방향.
10. 분기 화살표: 분기마다 분기점 j 의 next 칸 t 마다, 화살표 모양을 두께 0.25 돌출해 눕힌 형상(파란 0x3b9bff, 발광 0x0a2a55), j·t 중점 높이 1.2, t 쪽을 가리키게 회전, 1.1배. 매 프레임 y = `1.3 + 0.25·sin(4t)`.
11. `setActiveTile(i)`: 칸 재질 `uActive = i`.

## 경계 조건
- 서브맵 칸(route 'sub')도 같은 방식으로 그린다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 칸 A(0,0)→B(0,3) | `tileHeadings` | A 0, B 0 |
| 2 | 칸 A(0,0)→B(3,0) | `tileHeadings` | A π/2, B π/2 (prev 기준) |
| 3 | `BOARD` 의 시대 1 START | `tileColor` | ERAS[1].color |
| 4 | goal 칸 | `tileColor` | 0xffffff |
| 5 | star3 / destiny / love | `tileGlow` | 1 / 2 / 0 |

## 참조
- [atlas.md](../atlas/atlas.md), [stage.md](../../stage/stage.md), [toolkit.md](../../toolkit/toolkit.md)
- [data.md](../../../data/data.md): `BOARD`, `ERAS`, `TILE_INFO`, `Tile`, `RouteId`
