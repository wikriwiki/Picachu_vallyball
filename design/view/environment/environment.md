---
pyramid: leaf
id: environment
title: 자연 환경
parent: ../view.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `자연 환경` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 자연 환경

## 정의
보드를 둘러싼 자연이다. 하늘 구와 해(그림자를 드리우는 방향광), 보드 칸 범위를 감싸는 둥근 사각형 본섬 지형(보드 영역은 평지, 바깥은 언덕, 해변은 모래색, 땅색은 가까운 칸의 시대색), 섬 주위 바다, 서브맵 칸을 감싸는 작은 섬 3개와 이름표를 만든다. 도시 장식이 쓰는 지형 높이·보드 밖 거리·가까운 칸 찾기 함수를 공개한다.

## 인터페이스
- 구현 위치: `src/view/environment/environment.ts`, 테스트 `src/view/environment/environment.test.ts` (순수 함수만)
- 공개 API:
  ```ts
  export interface IslandRect { cx: number; cz: number; hx: number; hz: number; r: number; }
  export interface SubIsland extends IslandRect { id: SubmapId; }
  export interface Environment {
    readonly island: IslandRect;                  // 본섬
    readonly subIslands: SubIsland[];
    terrainHeight(x: number, z: number): number;
    boardOut(x: number, z: number): number;       // 보드 영역(여백 12) 밖으로 벗어난 거리
    nearestTile(x: number, z: number): [dist: number, tile: number]; // 본 맵 칸 중 가장 가까운 칸
  }
  export function islandRectOf(tiles: readonly { x: number; z: number; era: number }[]): IslandRect;
  export function subIslandsOf(tiles: readonly Tile[]): SubIsland[];
  export function buildEnvironment(stage: Stage): Environment;
  ```

## 동작 규칙
1. `islandRectOf`: 본 맵 칸(era ≥ 0)의 x·z 범위로 `cx, cz` = 중심, `hx = 폭/2 + 26`, `hz = 깊이/2 + 20`, `r = 22`.
2. `subIslandsOf`: 서브맵마다 그 칸들의 x·z 범위 중심, `hx 16, hz 14, r 9`, 순서는 `SUBMAP_IDS`.
3. 해: 방향 `(0.45, 0.85, 0.35)` 정규화, 색 0xfff4e0, 강도 1, 그림자 맵 2048, bias −0.0006, normalBias 0.03, radius 3. 매 프레임 `stage.target + 방향·70` 에 두고 target 을 보며, 그림자 카메라 범위는 `max(30, dist·0.9)` (1 넘게 차이 날 때만 갱신).
4. 하늘: 반지름 600 구, `skyMaterial`, `uSunDir` = 해 방향, 매 프레임 카메라 위치로 옮긴다.
5. 본섬 지형: 크기 `(2hx + 70) × (2hz + 70)`, 격자 간격 약 1.1 의 평면. 정점마다 `d = sdRoundBox(x−cx, z−cz, hx, hz, r)`: d > 0(바다 쪽)이면 높이 `−0.5 − min(0.25d, 6)`, 아니면 `0.02·min(1, −d/6) + hill² · 7 · min(1, boardOut/8) · min(1, −d/14)` (hill = 값 노이즈 두 겹 0.7·n(0.08) + 0.3·n(0.2), 노이즈 표는 `createRng(7)` 로 256개). 색: 가장 가까운 칸 시대의 `ground` × (0.9 + 0.2·노이즈(0.3)), 높이 2.5 넘으면 0x6e9e55 쪽으로 섞고, 해변(`−d` 1~5)은 모래 0xf4e2a8 로 섞는다. `toonMaterial(흰색, {vertexColors, grass 1, rim 0.05, specular 0})`, 그림자 받음.
6. `boardOut(x,z) = hypot(max(0, |x−cx'| − (칸 폭/2 + 12)), max(0, |z−cz'| − (칸 깊이/2 + 12)))` (cx', cz' 는 칸 범위 중심). `terrainHeight` 는 5번의 섬 안 식(d > 0 이면 −1).
7. 서브맵 섬: 섬마다 `(2hx+24) × (2hz+24)` 평면(60×56 분할), d > 0 이면 `−0.5 − min(0.3d, 5)` 아니면 0.02, 풀색 countryside 0x9fd46b / casino 0x7fc98a / shrine 0xa8d08d 에 해변 모래 섞기. 이름표 `textSprite(SUBMAPS[id].name, {bg '#4dd4f0', color '#fff', size 56, scale 1.2})` 를 `(cx, 7, cz − hz + 2)` 에.
8. 바다: 900×900 평면(220×220 분할), `waterMaterial`, 섬 4개(본섬 + 서브맵 섬)의 사각형·반지름과 해 방향을 넣고, `(cx, −1.1, cz)` 에 둔다. 매 프레임 `uTime` 갱신.
- 노이즈·색 식의 세부는 [참고: 기존 `public/js/world.js` 의 `buildTerrain`, `buildSubIslands`, `buildWater`].

## 경계 조건
- 서브맵 칸은 `nearestTile` 후보에서 뺀다.
- 섬 밖 좌표의 `terrainHeight` 는 −1.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 칸 (0,0),(10,20) (era 0) | `islandRectOf` | cx 5, cz 10, hx 31, hz 30, r 22 |
| 2 | 서브맵 칸이 섞인 목록 | `islandRectOf` | 서브맵 칸 무시 |
| 3 | `BOARD.tiles` | `subIslandsOf` | 3개, id 순서 countryside, casino, shrine, 각 중심이 그 서브맵 칸 범위 중심 |

## 참조
- [stage.md](../stage/stage.md): `Stage`
- [toolkit.md](../toolkit/toolkit.md): `skyMaterial`, `waterMaterial`, `toonMaterial`, `textSprite`, `sdRoundBox`
- [data.md](../../data/data.md): `BOARD`, `ERAS`, `SUBMAPS`, `SUBMAP_IDS`, `createRng`
