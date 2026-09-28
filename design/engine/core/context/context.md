---
pyramid: leaf
id: context
title: 컨텍스트
parent: ../core.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [엔진 코어](../core.md) 의 「자식 구성요소」 중 `컨텍스트` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 컨텍스트

## 정의
한 번의 판정(게임 생성 또는 조작 하나) 동안 쓰는 작업대다. 상태를 들고 있으면서 상태에 저장된 시드로 난수를 뽑고, 연출 이벤트를 모으며, 메시지 이벤트와 기록(최대 40줄)을 함께 남긴다.

## 인터페이스
- 구현 위치: `src/engine/core/context/context.ts`, 테스트 `src/engine/core/context/context.test.ts`
- 공개 API:
  ```ts
  export function createContext(state: GameState): Ctx;
  ```

## 동작 규칙
1. `rnd()`: `{ value, seed } = rngNext(state.rng)`, `state.rng = seed`, value 반환.
2. `rint(n) = floor(rnd() × n)`. `choose(arr) = arr[rint(arr.length)]`.
3. `player(id)`: `state.players` 에서 id 가 같은 플레이어. 없으면 `RuleError('플레이어가 없습니다.')`.
4. `log(text)`: `state.log` 에 추가하고 길이가 `LOG_MAX(40)` 를 넘으면 맨 앞을 뺀다.
5. `msg(p, text, kind = 'info')`: 이벤트 `{ t:'msg', pid: p?.id ?? null, text, kind }` 를 남기고, 기록에 `p ? "{이름}: {text}" : text` 를 남긴다.
6. `events` 는 새 빈 배열로 시작한다.

## 경계 조건
- 컨텍스트를 두 개 만들어 번갈아 뽑아도 같은 상태 객체를 공유하므로 수열이 이어진다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | state.rng 5 | `rnd()` 3번 | `createRng(5)` 의 처음 3개와 같음, state.rng 가 바뀜 |
| 2 | — | `rint(10)` 1000번 | 모두 0~9 정수 |
| 3 | 기록 39줄 | `log` 2번 | 40줄, 가장 오래된 줄 빠짐 |
| 4 | 플레이어 '가' | `msg(p, '안녕', 'lucky')` | 이벤트 `{t:'msg', pid, text:'안녕', kind:'lucky'}`, 기록 '가: 안녕' |
| 5 | — | `msg(null, '시대')` | pid null, kind 'info', 기록 '시대' |
| 6 | — | `player('없음')` | RuleError |

## 참조
- [types.md](../types/types.md)
- [data.md](../../../data/data.md): `rngNext`, `LOG_MAX`
