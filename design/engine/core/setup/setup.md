---
pyramid: leaf
id: setup
title: 초기 상태
parent: ../core.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [엔진 코어](../core.md) 의 「자식 구성요소」 중 `초기 상태` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 초기 상태

## 정의
새 게임의 초기 상태를 만든다. 플레이어 1~4명을 시작 시대 START 칸에 세우고 기본 능력치·운세를 주며, 연애 후보 12명의 ★ 등급을 시드 난수로 정한다. 어른 모드면 어른 시절 전반에서 시작하고 능력치를 무작위로, 시작 자금을 300 으로 준다.

## 인터페이스
- 구현 위치: `src/engine/core/setup/setup.ts`, 테스트 `src/engine/core/setup/setup.test.ts`
- 공개 API:
  ```ts
  export function newGameState(opts: { players: PlayerSeed[]; mode?: Mode; seed: number }): GameState;
  ```

## 동작 규칙
1. 플레이어가 없거나 1명 미만·4명 초과면 `RuleError('플레이어는 1~4명이어야 합니다.')`.
2. `mode` 기본 `'full'`. 시작 시대 `startEra = mode === 'adult' ? ADULT_ERA : 0`.
3. 상태: `{ v:1, rng: seed >>> 0, mode, phase:'playing', era: startEra, round:0, turn:0, turnActive:false, players, partners, pending:null, queue:[], log:[], finishCount:0, result:null, seq:0 }`.
4. 플레이어 초기값: `{ id, name, avatar, cpu, tile: BOARD.eraStart[startEra], money:0, notes:0, stats:{int:5,phy:5,sen:5}, fortune: FORTUNE_START, job:null, rank:0, partner:null, spouse:null, subReturn:null, kids:[], cards:[], treasures:[], houses:[], club:null, college:false, cardUsed:false, doneEra:false, finished:false, finishOrder:null }`. `cpu` 는 boolean 으로.
5. 연애 후보: `PARTNERS` 순서대로, 난수 `r = rnd() × (STAR_WEIGHTS 합 100)`, k = 0.. 에서 `r −= STAR_WEIGHTS[k]` 해 음수가 되는 첫 k 의 `stars = k + 1`. 후보 = `{ id, name, job, personality, color, stars, takenBy: null }`.
6. 어른 모드면 후보를 정한 뒤, 플레이어 순서대로 `stats = { int: 15 + rint(45), phy: 15 + rint(45), sen: 15 + rint(45) }`, `money = ADULT_START_MONEY`.
7. 난수는 `rngNext` 로 `state.rng` 를 옮기며 뽑는다 (`rnd`: `{value, seed} = rngNext(rng)`, `rng = seed`; `rint(n) = floor(rnd()·n)`).
8. 대기·큐는 만들지 않는다 (진행의 `startGame` 몫).

## 경계 조건
- 입력 `players` 배열·객체를 그대로 참조하지 않는다 (새 객체).
- 시드 0 도 정상 동작.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 0명 / 5명 | `newGameState` | RuleError |
| 2 | 2명, seed 1 | 두 번 생성 | JSON 동일 |
| 3 | 2명, seed 1 / seed 2 | 비교 | partners 의 stars 배열이 (대부분의 경우) 다름 — 적어도 rng 값은 다름 |
| 4 | full 모드 | 생성 | 두 플레이어 tile = eraStart[0], money 0, stats 5 |
| 5 | adult 모드 seed 7 | 생성 | era 4, tile = eraStart[4], money 300, 각 능력치 15~59 |
| 6 | 1명 | 생성 | partners 12명, stars 1~5, takenBy null |

## 참조
- [types.md](../types/types.md)
- [data.md](../../../data/data.md): `BOARD`, `PARTNERS`, `STAR_WEIGHTS`, `FORTUNE_START`, `ADULT_ERA`, `ADULT_START_MONEY`, `rngNext`
