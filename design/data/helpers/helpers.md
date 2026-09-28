---
pyramid: leaf
id: helpers
title: 공용 헬퍼
parent: ../data.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [게임 데이터](../data.md) 의 「자식 구성요소」 중 `공용 헬퍼` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 공용 헬퍼

## 정의
여러 곳에서 함께 쓰는 작은 도구다. 32비트 시드 하나로 결정적 난수를 만드는 mulberry32 생성기(상태 저장형 한 걸음 함수와 클로저형)와, 만원 단위 금액을 "1억 2,000만원" 형식 문자열로 바꾸는 함수를 공개한다.

## 인터페이스
- 구현 위치: `src/data/helpers/helpers.ts`, 테스트 `src/data/helpers/helpers.test.ts`
- 공개 API:
  ```ts
  export function rngNext(seed: number): { value: number; seed: number }; // value ∈ [0,1)
  export function createRng(seed: number): () => number;
  export function formatMoney(man: number): string;
  ```

## 동작 규칙
1. `rngNext(seed)`: `a = (seed + 0x6d2b79f5) >>> 0`; `t = Math.imul(a ^ (a >>> 15), a | 1)`; `t ^= t + Math.imul(t ^ (t >>> 7), t | 61)`; `value = ((t ^ (t >>> 14)) >>> 0) / 4294967296`; 다음 시드는 `a`.
2. `createRng(seed)`: 내부 시드를 `seed >>> 0` 으로 두고, 호출마다 `rngNext` 로 한 걸음 가며 `value` 를 돌려준다.
3. `formatMoney(man)`: `neg = man < 0`, `v = |round(man)|`, `eok = floor(v / 10000)`, `rest = v % 10000`. 문자열 = (eok 가 있으면 `{eok}억`) + (rest 가 있거나 eok 가 0 이면: eok 가 있으면 공백 + `{rest 를 ko-KR 천 단위 쉼표}만`). 끝에 `원`, 음수면 앞에 `-`.

## 경계 조건
- `formatMoney(0)` = `0만원`, `formatMoney(10000)` = `1억원`, `formatMoney(-1500)` = `-1,500만원`, `formatMoney(12000)` = `1억 2,000만원`, `formatMoney(0.4)` = `0만원`.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | seed 20231006 | `createRng` 로 5개, `rngNext` 를 이어 5번 | 두 수열이 같다 |
| 2 | seed 0 | `rngNext(0).seed` | 0x6d2b79f5 |
| 3 | seed 1 | 1000번 뽑기 | 모두 [0,1), 평균 0.4~0.6 |
| 4 | — | 경계 조건의 5가지 | 명시된 문자열 |

## 참조
없음.
