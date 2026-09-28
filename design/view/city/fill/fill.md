---
pyramid: leaf
id: fill
title: 채우기
parent: ../city.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [도시 장식](../city.md) 의 「자식 구성요소」 중 `채우기` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 채우기

## 정의
남은 땅을 채운다. 레인과 도로 사이 도시 블록을 골목길로 나눈 칸마다 도로를 바라보는 건물(아기 구역 장난감 블록, 어른 구역 빌딩·상가, 그 외 상가·집)을 3.3 간격으로 촘촘히 세우고(12% 빈 터), 섬 곳곳에 집과 나무(둥근 나무·원뿔 나무·벚나무·단풍나무)를 흩뿌린다. 모두 종류별 인스턴싱 메시로 그린다.

## 인터페이스
- 구현 위치: `src/view/city/fill/fill.ts`, 테스트 `src/view/city/fill/fill.test.ts`
- 공개 API:
  ```ts
  export function blockCells(side: number): [number, number][];   // 골목으로 나뉜 x 구간 4개
  export function fillCity(ctx: CityCtx, roadDist: (x: number, z: number) => number): void;
  ```

## 동작 규칙
1. `blockCells(side) = [[−side + 3.2, −17.8], [−12.2, −2.8], [2.8, 12.2], [17.8, side − 3.2]]` (골목 −15·0·15 양옆 2.8 띄움).
2. 도시 블록: k = 0..rows−1, 방향 sgn [1, −1] 순서로 zc = k·RS + sgn·5.2 ([zMin+2, zMax−2] 밖이면 건너뜀). 각 구간 [xa, xb] 에서 x = xa + 1.6 부터 xb − 1.4 까지 3.3 간격: 사각형 x ± 1.5, zc ± 1.6 이 occupied 와 겹치거나 `tileNear(…, 1.5)` 면 건너뜀. `rng() < 0.12` 면 빈 터. 시대 = `env.nearestTile(x, zc)` 칸의 시대 id. 회전 = sgn > 0 ? 0 : π. `roll = rng()`: 아기 구역이고 roll < 0.35 → 장난감(크기 0.9), 어른 구역이고 roll < 0.45 → 빌딩(크기 1.25, 높이 4 + rng·6), roll < (어른 ? 0.75 : 0.35) → 상가(높이 1.8 + rng·1.6), 그 외 집(크기 1.2). 색은 각 팔레트에서 `floor(rng·개수)`. 놓은 자리 기록.
3. 흩뿌리기 2600번: `x = cx + (rng·2−1)·hx`, `z = cz + (rng·2−1)·hz` (본섬 사각형). 섬 경계 5 이내, 칸 3.4 이내, 도로 3.0 이내, occupied(여백 1.2), 이미 놓은 것 3.4 이내면 건너뜀. 높이 = `env.terrainHeight`. 도로에서 5.2 미만이고 칸에서 3.6 초과이고 rng < 0.75 면 건물(아기 장난감 / 어른 빌딩 45% / 그 외 집), 아니면 rng < 0.6 이면 둥근 나무(아기·초등·마지막 구역 40% 벚꽃색, 아니면 35% 단풍색, 나머지 초록), 그 외 원뿔 나무.
4. 인스턴싱: 종류별 형상(줄기·잎·원뿔·집 몸통·집 지붕·빌딩·장난감·상가 몸통·차양·지붕판)마다 InstancedMesh + 같은 행렬을 쓰는 외곽선 InstancedMesh. 그림자 드리우고 받음. 팔레트·형상 치수·재질: [기준 구현: 기존 `public/js/map.js` 의 채우기 블록과 `inst`].

## 경계 조건
- 건물·나무는 칸·도로·랜드마크 영역에 놓이지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | side 38 | `blockCells` | [[−34.8,−17.8],[−12.2,−2.8],[2.8,12.2],[17.8,34.8]] |
| 2 | 가짜 CityCtx(모든 칸이 멀리 있음, occupied 비어 있음, rng 고정 0.5) | `fillCity` | 예외 없음, scene 에 InstancedMesh 추가 |
| 3 | occupied 가 도시 전체를 덮음, 섬 크기 0 | `fillCity` | 도시 블록 건물 0개 (InstancedMesh 없음 또는 인스턴스 0) |

## 참조
- [city.md](../city.md) 의 `CityCtx`
- [environment.md](../../environment/environment.md): `terrainHeight`, `nearestTile`, `island`
- [toolkit.md](../../toolkit/toolkit.md): `toonMaterial`, `buildingMaterial`, `outlineMaterial`
- [data.md](../../../data/data.md): `BOARD`, `ERAS`
