---
pyramid: leaf
id: landmarks
title: 랜드마크
parent: ../city.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [도시 장식](../city.md) 의 「자식 구성요소」 중 `랜드마크` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 랜드마크

## 정의
시대마다 상징 건물을 놓는다. 시대 칸 구간의 30%·70% 지점 옆 블록에 랜드마크를 하나씩(자리가 겹치면 반대편·옆 블록으로), 결혼 예식장과 내 집 마련 저택은 해당 STOP 칸 옆에 둔다. 어른 후반 레인 높이 서쪽 해안에 마리나(부두 + 흔들리는 요트 5척), 마지막 레인 너머에 GOAL 성을 둔다.

## 인터페이스
- 구현 위치: `src/view/city/landmarks/landmarks.ts`, 테스트 `src/view/city/landmarks/landmarks.test.ts`
- 공개 API:
  ```ts
  export type LandmarkType = 'hospital' | 'playground' | 'schoolElem' | 'field' | 'schoolMiddle' | 'gym' | 'schoolHigh' | 'library'
    | 'offices' | 'apartments' | 'chapel' | 'mall' | 'mansion' | 'park' | 'onsen' | 'castle';
  export const DISTRICTS: Readonly<Record<EraId, { at30: LandmarkType; at70: LandmarkType; stop?: LandmarkType }>>;
  export const BUILDERS: Readonly<Record<LandmarkType, (g: THREE.Group) => void>>;
  export const BLOCK_OFF = 4.75;
  export const BLOCK_DEPTH = 6;
  export function landmarkCandidates(tileX: number, tileZ: number): [number, number, 1 | -1][];
  export function placeLandmarks(ctx: CityCtx): void;
  ```

## 동작 규칙
1. `DISTRICTS`: baby {at30 hospital, at70 playground}, elem {schoolElem, field}, middle {schoolMiddle, gym}, high {schoolHigh, library}, adult1 {offices, apartments, stop chapel}, adult2 {mall, offices, stop mansion}, final {park, onsen}.
2. `landmarkCandidates(x, z)`: `x' = clamp(x, −ROW/2 + 7, ROW/2 − 7)`, `laneZ = round(z / RS)·RS`, dx 순서 [0, −12, 12, −24, 24], 각 dx 마다 s 순서 [1, −1] 로 `(x' + dx, laneZ + s·BLOCK_OFF, s)`.
3. 배치 `place(type, tile)`: 후보마다 |cx| > ROW/2 − 6 이면 건너뜀, 사각형 `(cx ± 6, cz ± 3)` 이 `occupied` 와 겹치거나, cz 가 [zMin, zMax] 밖이거나, `tileNear(사각형)` 이면 건너뜀. 처음 통과한 후보에 그룹을 만들어 `BUILDERS[type]` 로 채우고 위치 `(cx, 0.02, cz)`, 회전 `s > 0 ? π : 0` (앞면이 레인 쪽), `occupied` 에 추가. 공원 분수(`userData.jet`)는 매 프레임 y 배율 `1 + 0.08·sin(6t)`, 온천 김(`userData.steam`)은 위로 오르며 커지고 옅어진다.
4. 시대 순서대로: stop 이 있으면 그 시대의 STOP 칸에 먼저, 그다음 `round(s0 + (s1 − s0)·0.3)` 칸에 at30, `·0.7` 칸에 at70 (s0 = eraStart, s1 = eraEnd).
5. 마리나: `zc = round(((어른 후반 START z + END z)/2) / RS)·RS + RS/2 + 5`, `x0 = −side − ROAD_W/2 − 1`, 부두 길이 `x0 − (−island.hx − 14)`… [기준 구현: 기존 `public/js/map.js` 의 마리나 블록]. occupied 에 `(x0 − 길이 ~ x0, zc ± 7)` 추가. 요트는 `y = −0.95 + 0.12·sin(1.4t + 위상)` 으로 흔들린다.
6. GOAL 성: 마지막 END 칸 x 를 ±(ROW/2 − 6) 으로 자른 위치, z = zMax + ROAD_W/2 + 4.5, `BUILDERS.castle`. occupied 추가.
7. `BUILDERS` 각 형상(병원·놀이터·학교 3종·운동장·체육관·도서관·오피스 3동·아파트·예배당·쇼핑몰·저택·공원·온천·성)은 로컬 좌표(앞면 +z, 바닥 y 0, 폭 ≤ 12, 깊이 ≤ 6)로 만든다. 치수·재질 색: [기준 구현: 기존 `public/js/map.js` 의 `BUILDERS`, `schoolBuilding`, `mats`]. 간판 글자는 원본과 같다 (산부인과, GYM, 도서관, ♥ WEDDING, SHOPPING MALL, ♨ 온천 요양원).

## 경계 조건
- 모든 후보가 막히면 그 랜드마크는 놓지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `landmarkCandidates(0, 22)` | 첫 후보 (0, 21+4.75, 1), 둘째 (0, 21−4.75, −1), 셋째 (−12, 25.75, 1), 총 10개 |
| 2 | — | `landmarkCandidates(40, 0)` | 첫 후보 x = 23 |
| 3 | — | `Object.keys(DISTRICTS)` | 7개 시대 |
| 4 | 빈 그룹 | 각 `BUILDERS[type](g)` | 예외 없음, 자식 1개 이상 |

## 참조
- [city.md](../city.md) 의 `CityCtx`
- [toolkit.md](../../toolkit/toolkit.md): 재질, `box`/`cyl`/`cone`/`gable`, `canvasTexture`
- [data.md](../../../data/data.md): `BOARD`, `ERAS`, `LAYOUT`, `EraId`
