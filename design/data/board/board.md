---
pyramid: leaf
id: board
title: 보드
parent: ../data.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [게임 데이터](../data.md) 의 「자식 구성요소」 중 `보드` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 보드

## 정의
게임 보드를 만든다. 보드는 칸의 그래프다: 각 칸은 다음 칸 목록(`next`)을 가지며, 분기점은 다음 칸이 2개, 시대 끝·GOAL·귀환 칸은 0개다. 시대별 경로 구성대로 뱀 모양 직선 레인 위에 칸을 깔고, 분기 구간에는 레인 위의 연애 길과 옆으로 돌아가는 우회로(커리어·공부 길)를 만든다. 고정 칸(STOP·여행)과 월급날·운명의 하트를 먼저 놓고, 나머지 칸은 가중치 비율대로 정확히 배분해 고정 시드로 섞는다. 서브맵 섬 3개의 칸도 만든다. 같은 입력이면 항상 같은 보드다.

## 인터페이스
- 구현 위치: `src/data/board/board.ts`, 테스트 `src/data/board/board.test.ts`
- 공개 API:
  ```ts
  export interface Tile {
    i: number; era: number;            // 서브맵은 era = -1
    x: number; z: number;              // 3D 배치 좌표
    type: TileType; route: RouteId | 'sub';
    next: number[];
    stop?: 'marriage' | 'house';       // type 'stop' 일 때
    sub?: SubmapId;                    // 여행 칸(가는 서브맵) 또는 서브맵 칸(속한 서브맵)
    ret?: number;                      // 여행 칸: 귀환할 본 맵 칸
    detour?: 1 | -1;                   // 우회로 칸: 레인 기준 위/아래
  }
  export interface Branch { era: number; junction: number; a: number[]; b: number[]; merge: number; routes: [RouteId, RouteId]; }
  export interface Board { tiles: Tile[]; eraStart: number[]; eraEnd: number[]; branches: Branch[]; subStart: Record<SubmapId, number>; }
  export const LAYOUT: { STEP: 3.0; ROW: 60; RS: 21; SUB_X: 108; SUB_Z0: 30; SUB_DZ: 70 };
  export const BOARD_SEED = 20231006;
  export const MAIN_WEIGHTS: Readonly<Record<EraId, Partial<Record<TileType, number>>>>;
  export const ROUTE_WEIGHTS: Readonly<Record<'love' | 'career' | 'study', Partial<Record<TileType, number>>>>;
  export function lanePoint(s: number): { x: number; z: number; straight: number; lane: number };
  export function quota(weights: Partial<Record<TileType, number>>, n: number): TileType[];
  export function shuffleNoRepeat(rng: () => number, arr: TileType[]): TileType[];
  export function buildBoard(): Board;
  export const BOARD: Board;                       // 모듈 로드 시 buildBoard() 한 번
  export function stepsToPayday(tile: number): number | null;
  ```

### 가중치 [추정]
| MAIN_WEIGHTS | star1 | star2 | star3 | love | hiyari | ghost | choice | card | challenge | baby |
|---|---|---|---|---|---|---|---|---|---|---|
| baby | 7 | 2 | 1 | – | 1 | – | 2 | 1 | – | – |
| elem | 7 | 3 | 1 | – | 2 | 1 | 2 | 1 | – | – |
| middle | 7 | 3 | 1 | – | 2 | 1 | 2 | 1 | – | – |
| high | 6 | 3 | 1 | 1 | 2 | 1 | 2 | 1 | – | – |
| adult1 | 5 | 3 | 1 | 1 | 2 | 1 | 2 | 1 | 2 | 1 |
| adult2 | 5 | 3 | 1 | 1 | 2 | 2 | 2 | 1 | 2 | 2 |
| final | 6 | 3 | 1 | 1 | 2 | 2 | 2 | 1 | – | – |

- 객체 키 순서는 위 열 순서가 아니라 다음 순서다 (배분 결과 순서에 영향): baby `star1,star2,star3,hiyari,choice,card` / elem·middle `star1,star2,star3,hiyari,ghost,choice,card` / high·final `star1,star2,star3,love,hiyari,ghost,choice,card` / adult1·adult2 `star1,star2,star3,love,hiyari,ghost,choice,card,challenge,baby`.
- `ROUTE_WEIGHTS`: love `{love:6, star1:2, star2:1, hiyari:1, choice:1}`, career `{challenge:5, star2:3, star1:2, card:1, hiyari:1, ghost:1}`, study `{star2:4, star1:3, card:2, choice:2, hiyari:1}` (이 키 순서).

## 동작 규칙
1. `lanePoint(s)`: `per = ROW + RS = 81`, `k = floor(s / per)`, `u = s − k·per`, `dir = k 짝수 ? 1 : −1`, `z0 = k·RS`, `xStart = dir = 1 ? −30 : 30`. `u < ROW` 이면 `{ x: xStart + dir·u, z: z0, straight: ROW − u, lane: k }`, 아니면 `{ x: xStart + dir·ROW, z: z0 + (u − ROW), straight: 0, lane: k }`. s 가 음수면 0 으로.
2. `quota(weights, n)`: 전체 가중치 합 W, 종류별 `v = w/W·n`, 기본 `floor(v)`. 남은 칸 수만큼 소수 부분이 큰 순서(안정 정렬, 같으면 키 순서)로 1씩 더한다. 결과는 키 순서대로 개수만큼 이어 붙인 배열.
3. `shuffleNoRepeat(rng, arr)`: Fisher–Yates (i = 끝부터 1까지, `j = floor(rng()·(i+1))` 와 교환). 그 뒤 4번 반복: i = 1..끝에서 `arr[i] === arr[i−1]` 이고 `star1` 이 아니면, `arr[k] !== arr[i]` 이고 `k !== i` 이고 `arr[k−1] !== arr[i]` 이고 `arr[k+1] !== arr[i]` 인 첫 k 를 찾아 교환 (없으면 그대로).
4. `buildBoard()`: rng = `createRng(BOARD_SEED)`, 누적 거리 s = 0, 직전 칸 prev = 없음, 분기 번호 0. 시대 순서대로:
   - 일반 칸 추가 `mainAt(fixed?)`: `lanePoint(s)` 위치에 칸을 만들고(`route 'main'`), 이 시대에 이미 칸이 있으면 `prev.next` 에 잇는다. prev = 새 칸, s += STEP.
   - `{main: n}` 파트: 직전 파트가 분기라서 합류 칸이 이미 있으면 k = 1 부터, 아니면 0 부터 n−1 까지 `mainAt(fixed[k])`. 고정 번호는 합류 칸을 0번으로 센다.
   - `{branch: L}` 파트: `q = lanePoint(s − STEP)` 가 `q.straight ≥ (L+1)·STEP + 0.01` 이고 `q.straight < ROW` 가 될 때까지 `mainAt()` 을 더 깐다 (80번 넘으면 오류). 분기점 J = prev, `jp = lanePoint(s − STEP)`, `side = 분기 번호 짝수 ? 1 : −1` (분기 번호 1 증가).
     - a 길: k = 1..L, `lanePoint(s − STEP + k·STEP)` 위치, route = a, J 부터 차례로 잇는다.
     - b 길 좌표: `[jp.x, jp.z + side·3]`, `[jp.x, jp.z + side·6]`, k = 1..L+1 의 `lanePoint(s − STEP + k·STEP)` 에서 `z + side·6`, 끝으로 `lanePoint(s − STEP + (L+1)·STEP)` 에서 `z + side·3`. 모두 L+4 칸, route = b, `detour = side`, J 부터 차례로 잇는다.
     - `s = s − STEP + (L+1)·STEP`, prev = a 길 끝, 합류 칸 M = `mainAt()`, b 길 끝의 next 에 M 을 추가. 분기 기록 `{ era, junction: J, a, b, merge: M, routes:[a,b] }`.
   - 시대 칸 목록의 첫 칸이 `start`, route main 인 마지막 칸이 `end`(마지막 시대는 `goal`)이며 그 칸의 `next` 는 비운다. `eraStart`, `eraEnd` 에 기록.
   - 칸 종류 배정: ① 고정 칸 `stop:<x>` → `type 'stop'`, `stop = x`; `travel:<id>` → `type 'travel'`, `sub = id`. ② `payEvery > 0` 이면 main 칸만 START 부터 d = 0,1,2… 로 세어 종류가 없고 `d > 0` 이고 `d % payEvery === 0` 인 칸을 `payday`. ③ 이 시대의 분기마다: a 가 love 면 a 길 가운데 칸(`floor(길이/2)` 번째)을 `destiny`, b 가 career 면 b 길 가운데 칸을 `payday`. 그 다음 a 길, b 길 순서로 종류 없는 칸 수 n 에 대해 `shuffleNoRepeat(rng, quota(ROUTE_WEIGHTS[길], n))` 을 차례로 배정. ④ 시대의 종류 없는 나머지 칸에 `shuffleNoRepeat(rng, quota(MAIN_WEIGHTS[era.id], n))` 을 배정.
   - 서브맵: `SUBMAP_IDS` 순서 si 로 `X0 = SUB_X`, `Z0 = SUB_Z0 + si·SUB_DZ`, 칸 k = 0..9 는 `x = k < 5 ? X0 + k·STEP : X0 + (9−k)·STEP`, `z = k < 5 ? Z0 : Z0 + 7`, `era −1`, `route 'sub'`, `sub = id`, 종류는 서브맵 표 순서, 차례로 잇는다. `subStart[id]` = 첫 칸.
   - 여행 칸의 `ret`: 여행 칸에서 `next[0]` 을 `TRAVEL_SHORTCUT` 번 따라간 칸 (도중에 next 가 없으면 거기서 멈춤).
5. `stepsToPayday(i)`: 칸이 없거나 서브맵 칸이면 `null`. i 에서 너비 우선으로 `next` 를 따라가며 처음 만나는 `payday` 칸까지의 거리(1 이상). 300 단계 안에 없으면 `null`.

## 경계 조건
- 분기 구간(분기점~합류점)은 반드시 한 직선 레인 안에 있다.
- `BOARD` 는 모듈 로드 시 한 번만 만들어지고, `buildBoard()` 를 다시 불러도 같은 결과다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `BOARD.tiles.length`, 본 맵 칸 수 | 428, 398 |
| 2 | — | 시대·길별 칸 수 | 아기 14 / 초등 28 / 중등 28 / 고등 main 23·love 10·study 14 / 어른 전반 main 74·love 26·career 34 / 어른 후반 main 57·love 24·career 32 / 마지막 34 |
| 3 | — | 시대·길별 종류 구성 | 아래 「생성 결과」 표와 같다 |
| 4 | — | 모든 칸의 next 개수 | 분기점 2, END·GOAL·귀환 0, 나머지 1 |
| 5 | — | `lanePoint(0)`, `lanePoint(60)`, `lanePoint(81)` | (−30,0), (30,0) straight 0, (30,21) |
| 6 | — | `quota({a:1,b:1}, 3)` | ['a','a','b'] |
| 7 | — | 여행 칸 3개의 ret | 각 여행 칸에서 6칸 앞 |
| 8 | — | `stepsToPayday(eraStart[1])` | 7 |
| 9 | — | `buildBoard()` 두 번 | JSON 이 같다 |

### 생성 결과 (시드 20231006)
| 시대 | 길 | 구성 |
|---|---|---|
| 아기 | 일반 | START 1 · END 1 · 별1 6 · 별2 2 · 별3 1 · 물방울 1 · 선택 1 · 카드 1 |
| 초등 | 일반 | START 1 · END 1 · 별1 10 · 별2 4 · 별3 1 · 물방울 3 · 유령 1 · 선택 3 · 카드 1 · 월급 3 |
| 중등 | 일반 | START 1 · END 1 · 별1 10 · 별2 4 · 별3 1 · 물방울 3 · 유령 1 · 선택 3 · 카드 1 · 월급 3 |
| 고등 | 일반 | START 1 · END 1 · 별1 7 · 별2 3 · 별3 1 · 물방울 2 · 유령 1 · 하트 1 · 선택 2 · 카드 1 · 월급 3 |
| 고등 | 연애 | 별1 1 · 별2 1 · 물방울 1 · 하트 5 · 운명의 하트 1 · 선택 1 |
| 고등 | 공부 | 별1 4 · 별2 5 · 물방울 1 · 선택 2 · 카드 2 |
| 어른 전반 | 일반 | START 1 · END 1 · 별1 18 · 별2 11 · 별3 4 · 물방울 7 · 유령 3 · 하트 4 · 선택 7 · 카드 3 · 찬스 7 · 아기 3 · 월급 3 · STOP 1 · 여행 1 |
| 어른 전반 | 연애 | 별1 5 · 별2 2 · 물방울 2 · 하트 13 · 운명의 하트 2 · 선택 2 |
| 어른 전반 | 커리어 | 별1 5 · 별2 8 · 물방울 2 · 유령 2 · 카드 2 · 찬스 13 · 월급 2 |
| 어른 후반 | 일반 | START 1 · END 1 · 별1 12 · 별2 7 · 별3 2 · 물방울 5 · 유령 5 · 하트 2 · 선택 5 · 카드 2 · 찬스 5 · 아기 5 · 월급 3 · STOP 1 · 여행 1 |
| 어른 후반 | 연애 | 별1 4 · 별2 2 · 물방울 2 · 하트 12 · 운명의 하트 2 · 선택 2 |
| 어른 후반 | 커리어 | 별1 4 · 별2 8 · 물방울 2 · 유령 2 · 카드 2 · 찬스 12 · 월급 2 |
| 마지막 | 일반 | START 1 · GOAL 1 · 별1 10 · 별2 5 · 별3 2 · 물방울 3 · 유령 3 · 하트 2 · 선택 3 · 카드 1 · 월급 2 · 여행 1 |

## 참조
- [tables.md](../tables/tables.md): `ERAS`, `RouteId`, `EraId`
- [tile-types.md](../tile-types/tile-types.md): `TileType`, `SUBMAPS`, `SUBMAP_IDS`, `TRAVEL_SHORTCUT`
- [helpers.md](../helpers/helpers.md): `createRng`
