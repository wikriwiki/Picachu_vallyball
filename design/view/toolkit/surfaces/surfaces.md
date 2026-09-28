---
pyramid: leaf
id: surfaces
title: 표면 재질
parent: ../toolkit.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [렌더 도구](../toolkit.md) 의 「자식 구성요소」 중 `표면 재질` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 표면 재질

## 정의
툰 조명 위에 무늬를 그리는 표면 재질 세 가지다. 도로(아스팔트·점선 중앙선·가장자리 흰 선·인도 타일), 건물(벽면의 월드 좌표 창문 격자와 불 켜진 창, 벽돌 무늬), 보드 칸(둥근 사각 흰 테두리, 칸 색, 아이콘 아틀라스, 광택 줄, 별 Lv3 빛 줄기·반짝임, 운명의 하트 무지개, 활성 칸 튀어 오름·발광).

## 인터페이스
- 구현 위치: `src/view/toolkit/surfaces/surfaces.ts`, 테스트 `src/view/toolkit/surfaces/surfaces.test.ts`
- 공개 API:
  ```ts
  export function roadMaterial(): THREE.ShaderMaterial;
  export interface BuildingOptions { win?: [number, number]; glass?: THREE.ColorRepresentation; brick?: boolean; floor0?: number; specular?: number; rim?: number; vertexColors?: boolean; }
  export function buildingMaterial(color?: THREE.ColorRepresentation, opts?: BuildingOptions): THREE.ShaderMaterial;
  export function tileMaterial(atlas: THREE.Texture, grid: THREE.Vector2): THREE.ShaderMaterial;
  ```

## 동작 규칙
1. `roadMaterial()`: 기본색 0x6b6f7a, uv.x = 길이(월드 단위), uv.y = 폭 0~1. 폭 중심에서 거리 y 로: 점선 중앙선(길이 3 주기 절반, 폭 0.022), 가장자리 선(0.7~0.74), 바깥 20%(y > 0.8)는 밝은 인도 타일. rim 0.05, specular 0. `sharedMaterials` 에 넣는다.
2. `buildingMaterial(color, opts)`: 유니폼 `uWin` (창 가로·세로 간격, 없으면 창 없음), `uGlass` (기본 0x5aa9e6), `uBrick`, `uFloor0` (기본 0.5, 이 높이 아래는 창 없음). 수직 벽면(|월드 법선 y| < 0.5)에만 무늬: 벽돌이면 줄마다 반 칸 어긋난 벽돌·줄눈, 창 칸 안쪽(가로 0.22~0.78, 세로 0.2~0.75)은 프레넬로 하늘을 섞은 유리 + 사선 반사, 창 칸의 14%는 불 켜진 창(따뜻한 색, 약한 발광), 창 아래 흰 창틀. specular 기본 0.2, rim 0.25. 인스턴스 색 지원.
3. `tileMaterial(atlas, grid)`: 유니폼 `uAtlas`, `uGrid`, `uActive`(−1), `uTime`, `uTileHalf` (1.3, 1.3), `uTopY` 0.5. 인스턴스 속성 `aIcon`(아틀라스 번호), `aIndex`(칸 번호), `aColor`(칸 색), `aGlow`(0 없음, 1 별 Lv3, 2 운명의 하트). 활성 칸(`aIndex == uActive`)은 `0.25 + 0.12·sin(5t)` 만큼 떠오르고 발광. 윗면만 테두리·아이콘을 그리며 아이콘은 월드 축 기준(카메라 기본 방향에서 똑바로). 옆면은 색 × 0.72.
- GLSL 세부 식: [기준 구현: 기존 `public/js/shaders.js` 의 `roadMaterial`, `buildingMaterial`, `tileMaterial`]. 텍스처는 분기 밖에서 샘플링하고, 아이콘 번호는 반올림해 격자 좌표를 구한다.

## 경계 조건
- `win` 이 없으면 창을 그리지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `buildingMaterial(0xffffff, {win:[1,2], brick:true})` | uWin (1,2), uBrick 1, uFloor0 0.5 |
| 2 | — | `buildingMaterial()` | uWin (0,0) |
| 3 | 빈 텍스처, grid (6,6) | `tileMaterial` | uActive −1, uTileHalf (1.3,1.3), sharedMaterials 포함 |
| 4 | — | `roadMaterial()` | uSpecular 0 |

## 참조
- [toon.md](../toon/toon.md): `TOON_LIGHT_FN`, `toonUniforms`, `sharedMaterials`
