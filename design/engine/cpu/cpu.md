---
pyramid: leaf
id: cpu
title: CPU
parent: ../engine.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `CPU` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# CPU

## 정의
대기 중인 룰렛·선택에 대해 CPU 또는 자동 진행이 보낼 조작을 고른다. 판정 난수는 쓰지 않고, 인자로 받은 의사결정용 난수만 쓴다. 상태를 바꾸지 않는다.

## 인터페이스
- 구현 위치: `src/engine/cpu/cpu.ts`, 테스트 `src/engine/cpu/cpu.test.ts`
- 형태: 순수 함수
- 공개 API:
  ```ts
  export function chooseAction(state: GameState, rand?: () => number): Action | null; // rand 기본 Math.random
  ```

## 동작 규칙
1. 대기가 없으면 `null`. `p` = 대기 주체.
2. 룰렛 대기:
   - 목적이 `move` 이고 이번 차례 카드를 안 썼고 손패가 있으면: 타이밍이 `now` 이고 (승진 카드면 직업이 있을 때만) 쓸 수 있는 첫 카드가 있고 `rand() < 0.6` 이면 `{ type:'card', index }`. 아니면 더블 카드가 있고 `rand() < 0.4` 이면 그 카드.
   - 그 외 `{ type:'spin', power: rand() }`.
3. 선택 대기 (활성 선택지 목록 = `disabled` 가 아닌 번호):
   - `job`: 활성 선택지마다 점수 = 그 직업 `ranks[min(2, 랭크 수−1)].salary × (0.7 + rand() × 0.6)`, 최고 점수 선택 (동점이면 앞쪽).
   - `career`: 지력 ≥ 25 면 0, 아니면 1.
   - `route`: 연애 길 번호가 있으면, 미혼이고 `rand() < (상대 있음 ? 0.7 : 0.5)` 면 연애 길, 아니면 다른 길. 연애 길이 없으면 `floor(rand() × 선택지 수)`.
   - `crush`: 성격이 내 최고 능력치(동점이면 int→phy→sen 순서로 앞선 것)와 같은 후보의 첫 번호, 없으면 0.
   - `propose`: 0.
   - `destiny`: 현재 상대가 있고 후보 ★ > 현재 ★ 이고 호감도 < 50 이면 0, 아니면 1.
   - `travel`: `rand() < 0.7` 이면 0, 아니면 1.
   - `bet`: 현금 ≥ 3000 이고 `rand() < 0.3` 이면 1, 아니면 현금 ≥ 1000 이면 0, 아니면 2.
   - `house`: 현금 이하 가격인 집 중 가장 뒤(비싼) 선택지, 없으면 마지막(사지 않는다).
   - 그 외: 활성 선택지 중 `floor(rand() × 개수)` 번째.

## 경계 조건
- 룰렛 목적이 `move` 가 아니면 카드를 쓰지 않는다.
- 이미 카드를 쓴 차례면 카드를 고르지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 대기 없음 | `chooseAction` | null |
| 2 | move 대기, 손패 ['charm'], rand 0.1 | — | `{type:'card', index:0}` |
| 3 | move 대기, 손패 ['double'], rand 0.1 | — | `{type:'card', index:0}` (double 은 즉시 카드가 아니라 두 번째 규칙으로 선택) |
| 4 | move 대기, 손패 ['rankup'], 직업 없음, rand 항상 0.5 | — | `{type:'spin', power:0.5}` (쓸 카드가 없으면 카드용 난수를 뽑지 않음) |
| 5 | career 선택, 지력 30 / 10 | — | 0 / 1 |
| 6 | house 선택, 현금 9000 | — | 단독주택(8000) 번호 |
| 7 | bet 선택, 현금 500 | — | 2 |
| 8 | job 선택, rand 항상 0.5 | — | 활성 직업 중 3랭크 월급 최대 |

## 참조
- [core.md](../core/core.md): 타입
- [data.md](../../data/data.md): `CARDS`, `jobById`, `HOUSES`
