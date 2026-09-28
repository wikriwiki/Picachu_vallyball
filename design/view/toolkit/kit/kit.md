---
pyramid: leaf
id: kit
title: 3D 도구
parent: ../toolkit.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [렌더 도구](../toolkit.md) 의 「자식 구성요소」 중 `3D 도구` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 3D 도구

## 정의
3D 장면을 만들 때 반복해서 쓰는 작은 도구다. 툰 재질에 외곽선을 붙인 메시, 둥근 배경의 글자 스프라이트, 캔버스로 그린 텍스처, 바닥 기준으로 놓는 박스·원기둥·원뿔·박공 지붕, 둥근 사각형 거리 함수, 이징 함수를 제공한다.

## 인터페이스
- 구현 위치: `src/view/toolkit/kit/kit.ts`, 테스트 `src/view/toolkit/kit/kit.test.ts`
- 공개 API:
  ```ts
  export function outlined(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, opts?: { outline?: boolean; shadow?: boolean; thickness?: number }): THREE.Mesh;
  export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture;
  export function textSprite(text: string, opts?: { color?: string; bg?: string; size?: number; scale?: number }): THREE.Sprite;
  export function box(parent, w, h, d, mat, x?, y?, z?, opts?): THREE.Mesh;       // 바닥 y 기준
  export function cyl(parent, rTop, rBottom, h, mat, x?, y?, z?, seg?, opts?): THREE.Mesh;
  export function cone(parent, r, h, mat, x?, y?, z?, seg?, opts?): THREE.Mesh;
  export function gable(parent, w, h, d, mat, x?, y?, z?): THREE.Mesh;              // 삼각 박공 지붕
  export function sdRoundBox(px: number, pz: number, hx: number, hz: number, r: number): number;
  export function easeInOut(t: number): number;
  ```

## 동작 규칙
1. `outlined`: `new Mesh(geometry, material)`, `castShadow = shadow(기본 true)`, `receiveShadow = true`, parent 에 추가. `outline`(기본 true)이면 같은 형상에 외곽선 재질(두께가 있으면 `outlineMaterial(0x2a2238, thickness)`, 없으면 공유 `outlineMaterial(0x2a2238, 0.03)` 하나)을 입힌 메시를 자식으로 붙인다.
2. `canvasTexture`: 캔버스를 만들고 2D 컨텍스트가 있으면 draw 를 부른다 (없으면 건너뜀). `CanvasTexture`, sRGB, anisotropy 4.
3. `textSprite(text, {color '#fff', bg 'rgba(40,30,70,0.85)', size 64, scale 1})`: 글자 폭 + size 너비, 높이 size·1.6 캔버스에 둥근 배경과 가운데 글자(bold). 스프라이트 크기 `(폭/높이)·1.6·scale × 1.6·scale`, `depthWrite false`. 컨텍스트가 없으면 폭을 `text.length × size` 로 본다.
4. `box`/`cyl`/`cone`: 형상을 `outlined` 로 만들고 위치를 `(x, y + h/2, z)` 에. `cyl` 기본 분할 16, `cone` 16.
5. `gable(w, h, d)`: 밑변 w, 높이 h 삼각형을 깊이 d 로 돌출(가운데 정렬), 위치 (x, y, z).
6. `sdRoundBox(px, pz, hx, hz, r)`: `q = (|px| − hx + r, |pz| − hz + r)`, 결과 `|max(q, 0)| + min(max(qx, qz), 0) − r`.
7. `easeInOut(t)`: t < 0.5 이면 `2t²`, 아니면 `1 − (−2t + 2)²/2`.

## 경계 조건
- 바깥 거리 함수는 사각형 안에서 음수, 경계에서 0.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `sdRoundBox(0,0,10,5,2)` | −5 |
| 2 | — | `sdRoundBox(12,0,10,5,2)` | 2 |
| 3 | — | `easeInOut(0)`, `(0.5)`, `(1)` | 0, 0.5, 1 |
| 4 | 부모 그룹 | `outlined(g, geo, mat)` | 부모 자식 1, 그 메시 자식(외곽선) 1 |
| 5 | — | `outlined(g, geo, mat, {outline:false})` | 외곽선 없음 |
| 6 | — | `box(g, 2, 4, 2, mat, 1, 0, 3)` | 위치 (1, 2, 3) |
| 7 | 2D 컨텍스트 없는 환경 | `textSprite('가나')` | 예외 없음, Sprite 반환 |

## 참조
- [toon.md](../toon/toon.md): `outlineMaterial`
