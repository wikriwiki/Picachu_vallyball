---
pyramid: leaf
id: atlas
title: 아이콘 아틀라스
parent: ../board-view.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [보드 표현](../board-view.md) 의 「자식 구성요소」 중 `아이콘 아틀라스` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 아이콘 아틀라스

## 정의
보드 칸 아이콘 26가지를 한 장의 텍스처로 그린다. 128px 칸 6×6 격자 캔버스에 `TILE_TYPES` 순서대로 칸 종류의 도안(원작 화면 기준)을 그림자와 함께 그린다.

## 인터페이스
- 구현 위치: `src/view/board-view/atlas/atlas.ts`, 테스트 `src/view/board-view/atlas/atlas.test.ts`
- 공개 API:
  ```ts
  export const ATLAS_CELL = 128;
  export const ATLAS_GRID = 6;
  export function atlasCell(i: number): { cx: number; cy: number };   // i 번째 칸의 중심 픽셀
  export function makeIconAtlas(): { texture: THREE.Texture; grid: THREE.Vector2; index(type: TileType): number };
  ```

## 동작 규칙
1. `atlasCell(i) = { cx: (i % 6)·128 + 64, cy: floor(i / 6)·128 + 64 }`.
2. `index(type) = TILE_TYPES.indexOf(type)`.
3. 캔버스 768×768, 가운데 정렬 글자, 도안마다 그림자(`rgba(0,0,0,0.25)`, 아래 4px).
4. 도안: start 검정 'START' / star1 노란 별(흰 테두리) / star2 옅은 노랑 별 3개(갈색 테두리) / star3 빛살 8줄 + 흰 큰 별(주황 테두리) + 작은 별 둘 / payday 노란 동전 원 + '₩' / love 흰 하트 / hiyari 흰 물방울 + 하늘색 반사 / ghost 흰 유령 + 눈·입 / choice 흰 갈림길 화살표 / card 기울어진 흰 카드 + 파란 별 / challenge 흰 위쪽 화살표 / baby 흰 아기 얼굴 + 분홍 눈 / stop 흰 팔각형 + 빨간 'STOP' / end 회색 삼각 화살표 / goal 금갈색 'GOAL' / destiny 흰 하트 + 작은 별 둘 / travel 흰 비행기 / substart 'WELCOME' / rest 흰 'Zz' / farm 흰 당근 + 초록 잎 / bet 흰 주사위 / dig 흰 곡괭이 / jackpot 흰 '777' / pray 흰 도리이 / omikuji 분홍 쪽지 + '吉' / return 흰 순환 화살표. 좌표·크기: [기준 구현: 기존 `public/js/world.js` 의 `makeIconAtlas`].
5. 2D 컨텍스트가 없으면 빈 텍스처 (예외 없음).

## 경계 조건
- 26가지 모두 36칸 안에 들어간다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `atlasCell(7)` | {cx: 192, cy: 192} |
| 2 | — | `makeIconAtlas().index('star3')` | 3 |
| 3 | 2D 컨텍스트 없음 | `makeIconAtlas()` | 예외 없음, grid (6,6) |

## 참조
- [kit.md](../../toolkit/kit/kit.md): `canvasTexture`
- [data.md](../../../data/data.md): `TILE_TYPES`, `TileType`
