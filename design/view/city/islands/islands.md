---
pyramid: leaf
id: islands
title: 섬 장식
parent: ../city.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [도시 장식](../city.md) 의 「자식 구성요소」 중 `섬 장식` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 섬 장식

## 정의
서브맵 섬 3개를 꾸민다. 시골 마을에는 빨간 헛간·도는 풍차·밭, 일확천금 섬에는 금빛 카지노 건물과 간판·야자수, 신들의 섬에는 빨간 도리이·신사·석등을 칸 줄 뒤쪽에 놓고, 섬 둘레에 나무 14그루(신들의 섬은 벚꽃색)를 심는다.

## 인터페이스
- 구현 위치: `src/view/city/islands/islands.ts`, 테스트 `src/view/city/islands/islands.test.ts`
- 공개 API:
  ```ts
  export function ringTreeSpots(hx: number, hz: number): [number, number][];
  export function decorateIslands(ctx: CityCtx): void;
  ```

## 동작 규칙
1. `ringTreeSpots(hx, hz)`: k = 0..13, a = k/14·2π, `(cos a·(hx − 2.5), sin a·(hz − 2.5))`, 그중 `z > 6 && |x| < 8` 인 점은 뺀다 (건물 자리).
2. 섬마다 그룹을 `(cx, 0.02, cz)` 에 두고, `back = −4.5` 기준 뒤쪽(z = back + 12~15)에 섬 전용 장식을 둔다. 시골 마을의 풍차 날개는 매 프레임 `rotation.z = 1.2t`. 치수·색: [기준 구현: 기존 `public/js/map.js` 의 서브맵 섬 장식 블록].
3. 둘레 나무: 줄기(0.15~0.22, 높이 1.2, 갈색) + 잎(반지름 1 이십면체, y 1.9), 잎 색 shrine 0xf8a5c2, casino 0x40c057, countryside 0x8ce99a.

## 경계 조건
- 서브맵 섬이 없으면 아무것도 하지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | hx 16, hz 14 | `ringTreeSpots` | 뒤쪽 가운데 점이 빠진 목록, 모든 점이 반경 안 |
| 2 | 가짜 CityCtx(서브맵 섬 3개) | `decorateIslands` | 장면에 그룹 3개, updaters 1개 (풍차) |
| 3 | 서브맵 섬 0개 | `decorateIslands` | 장면 변화 없음 |

## 참조
- [city.md](../city.md) 의 `CityCtx`
- [environment.md](../../environment/environment.md): `subIslands`
- [toolkit.md](../../toolkit/toolkit.md)
