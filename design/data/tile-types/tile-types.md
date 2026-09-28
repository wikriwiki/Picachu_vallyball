---
pyramid: leaf
id: tile-types
title: 칸 종류
parent: ../data.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [게임 데이터](../data.md) 의 「자식 구성요소」 중 `칸 종류` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 칸 종류

## 정의
보드 칸의 종류 목록과 각 종류의 이름·색, 서브맵 3종의 칸 순서와 이름, 여행 귀환 지름길 칸 수를 정의한다. 색은 원작 화면 기준이다.

## 인터페이스
- 구현 위치: `src/data/tile-types/tile-types.ts`, 테스트 `src/data/tile-types/tile-types.test.ts`
- 공개 API:
  ```ts
  export type TileType = 'start' | 'star1' | 'star2' | 'star3' | 'payday' | 'love' | 'hiyari' | 'ghost' | 'destiny'
    | 'travel' | 'choice' | 'card' | 'challenge' | 'baby' | 'stop' | 'end' | 'goal'
    | 'substart' | 'rest' | 'farm' | 'bet' | 'dig' | 'jackpot' | 'pray' | 'omikuji' | 'return';
  export const TILE_TYPES: readonly TileType[];   // 아래 표 순서 (아이콘 아틀라스 순서로도 쓰임)
  export const TILE_INFO: Readonly<Record<TileType, { name: string; color: number }>>;
  export type SubmapId = 'countryside' | 'casino' | 'shrine';
  export const SUBMAP_IDS: readonly SubmapId[];   // ['countryside','casino','shrine']
  export const SUBMAPS: Readonly<Record<SubmapId, { name: string; tiles: readonly TileType[] }>>;
  export const SUB_TILE_TYPES: readonly TileType[]; // substart, rest, farm, bet, dig, jackpot, pray, omikuji, return
  export const TRAVEL_SHORTCUT = 6;
  ```

### TILE_INFO (표 순서 = TILE_TYPES 순서)
| type | 이름 | 색 |
|---|---|---|
| start | 출발 | 0xffffff |
| star1 | 별 칸 Lv1 | 0xfff1a8 |
| star2 | 별 칸 Lv2 | 0xffa23a |
| star3 | 별 칸 Lv3 | 0xffd23f |
| payday | 월급날 | 0x51cf66 |
| love | 하트 칸 | 0xff7eb6 |
| hiyari | 물방울 칸 (아슬아슬) | 0x7cc7ff |
| ghost | 유령 칸 (대위기) | 0x6c4fc4 |
| destiny | 운명의 하트 칸 | 0xff9ecf |
| travel | 여행 칸 | 0x4dd4f0 |
| choice | 선택 칸 | 0x8ce0c4 |
| card | 카드 칸 | 0x5c9dff |
| challenge | 랭크업 찬스 | 0x22b8cf |
| baby | 아기 칸 | 0xf7a8c8 |
| stop | STOP | 0xe03131 |
| end | 다음 시대로 | 0xffffff |
| goal | GOAL | 0xffd700 |
| substart | 서브맵 출발 | 0xffffff |
| rest | 휴식 칸 | 0xa9e34b |
| farm | 수확 칸 | 0xffc078 |
| bet | 베팅 칸 | 0xf03e3e |
| dig | 보물 캐기 칸 | 0xc0915e |
| jackpot | 잭팟 칸 | 0xfab005 |
| pray | 기도 칸 | 0xe8590c |
| omikuji | 운세 뽑기 칸 | 0xfff0f6 |
| return | 귀환 칸 | 0x4dd4f0 |

### SUBMAPS (10칸 한 줄) [원작 구조 / 순서 추정]
| id | 이름 | 칸 1~10 |
|---|---|---|
| countryside | 🌾 시골 마을 | substart, rest, farm, star1, rest, farm, star2, rest, star3, return |
| casino | 🎰 일확천금 섬 | substart, bet, dig, bet, ghost, dig, bet, star3, jackpot, return |
| shrine | ⛩️ 신들의 섬 | substart, pray, star1, pray, omikuji, star2, pray, omikuji, star3, return |

## 동작 규칙
1. `TILE_TYPES` 는 위 표 순서의 26개 종류다.
2. 서브맵은 모두 10칸, 첫 칸 `substart`, 마지막 칸 `return`.

## 경계 조건
- `TILE_INFO` 의 키 집합은 `TILE_TYPES` 와 같다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `TILE_TYPES.length`, `Object.keys(TILE_INFO)` | 26, 같은 집합 |
| 2 | — | 각 서브맵 칸 수·첫 칸·끝 칸 | 10, substart, return |
| 3 | — | `TILE_TYPES.indexOf('star3')` | 3 |

## 참조
없음.
