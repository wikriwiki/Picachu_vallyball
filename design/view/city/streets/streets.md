---
pyramid: leaf
id: streets
title: 거리
parent: ../city.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [도시 장식](../city.md) 의 「자식 구성요소」 중 `거리` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 거리

## 정의
도시의 뼈대인 거리다. 레인과 레인 한가운데를 지나는 가로 도로, 블록을 나누는 세로 골목길 세 줄, 보드 양옆 가장자리 도로를 깔고, 보드 길이 도로를 건너는 곳에 횡단보도, 인도를 따라 가로등, 가로 도로를 양방향으로 달리는 차량 14대를 둔다. 다른 장식이 도로를 피할 수 있도록 도로까지 거리 함수를 돌려준다.

## 인터페이스
- 구현 위치: `src/view/city/streets/streets.ts`, 테스트 `src/view/city/streets/streets.test.ts`
- 공개 API:
  ```ts
  export const ROAD_W = 4.8;               // 차도 3.2 + 인도 0.8×2
  export const ALLEYS = [-15, 0, 15];
  export function makeRoadDist(roadZs: readonly number[], side: number, zMin: number, zMax: number): (x: number, z: number) => number;
  export function lampSpots(roadZs: readonly number[], side: number, row: number): [number, number][];
  export function buildStreets(ctx: CityCtx): (x: number, z: number) => number;
  ```

## 동작 규칙
1. 도로 메시: 길이 len × 폭 ROAD_W 평면(길이 2 마다 분할), uv.x 에 길이를 곱해 `roadMaterial` 의 점선 주기를 월드 단위로 맞춘다. 가로 도로는 y 0.06, 세로는 0.055, 그림자 받음. 가로 도로: roadZs 마다 중심 (0, z), 길이 `2·side + ROAD_W`. 골목길: ALLEYS 마다 중심 (x, (zMin+zMax)/2), 길이 `zMax − zMin`. 가장자리: x = ±side, 길이 `zMax − zMin + ROAD_W`.
2. `makeRoadDist(x, z)`: 최솟값 — |x| ≤ side + ROAD_W 이면 각 가로 도로까지 |z − rz|; z 가 [zMin − ROAD_W, zMax + ROAD_W] 안이면 ||x| − side| 와 각 골목까지 |x − ax|. 해당 없으면 Infinity.
3. 횡단보도: k = 0..rows−2 에 대해 cx = (k 짝수 ? ROW/2 : −ROW/2), 줄무늬 7개 (x = cx + i·0.8, i = −3..3), y 0.075, z = k·RS + RS/2, 흰 박스 0.42×0.02×3.1 인스턴싱.
4. `lampSpots`: 각 가로 도로 z 에 대해 x = −side + 6 부터 side − 6 까지 12 간격. |(|x| − row/2)| < 3 이거나 어떤 골목과 3 이내면 건너뛴다. 위치 z 는 지금까지 놓은 개수가 홀수면 `z + (ROAD_W/2 − 0.3)`, 짝수면 `z − (ROAD_W/2 − 0.3)`. 기둥(0.07~0.09, 높이 2.6, 0x495057) + 등(반지름 0.22, 높이 2.7, 0xfff3bf 발광 0x6b5a1a) 인스턴싱.
5. 차량 14대: 색 순환 `[0xff6b6b, 0x4dabf7, 0xffd43b, 0x51cf66, 0xffffff, 0xcc5de8, 0xff922b]`, 몸체 1.5×0.5×0.8, 창 0.8×0.4×0.7(0x9fd4ff), 바퀴 4개. i 홀수면 방향 +1 아니면 −1, 도로 z = roadZs[floor(rng·개수)], 속도 3.5 + rng·3, 시작 x = −side + rng·2side, z = 도로 z + 방향·0.75 (난수 호출 순서: 도로, 속도, x). 매 프레임 `x += 방향·속도·dt`, side 를 넘으면 반대편으로. 몸체는 횡단보도(|(|x| − ROW/2)| < 3) 밖에서 살짝 들썩인다.

## 경계 조건
- 도로 거리 함수는 도시 밖 좌표에서 Infinity 일 수 있다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | roadZs [−10.5, 10.5], side 38, zMin −10.5, zMax 10.5 | `roadDist(0, 10.5)` | 0 |
| 2 | 같음 | `roadDist(38, 0)` | 0 |
| 3 | 같음 | `roadDist(5, 0)` | 5 (골목 0 까지) |
| 4 | roadZs [10.5], side 38, row 60 | `lampSpots` | x 가 ±30 근처(3 이내)와 골목 3 이내가 아닌 점들, z 가 10.5 ± 2.1 번갈아 |

## 참조
- [city.md](../city.md) 의 `CityCtx` (부모 소유 타입)
- [toolkit.md](../../toolkit/toolkit.md): `roadMaterial`, `toonMaterial`, `outlined`
- [data.md](../../../data/data.md): `LAYOUT`
