---
pyramid: leaf
id: scheduler
title: 턴 스케줄러
parent: ../server.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [서버](../server.md) 의 「자식 구성요소」 중 `턴 스케줄러` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 턴 스케줄러

## 정의
다음 자동 진행까지 기다릴 시간을 계산하는 순수 함수 모음이다. 방송한 이벤트들을 클라이언트가 연출하는 데 걸릴 시간을 추정하고, 대기 중인 조작 주체가 CPU·접속 중인 사람·끊긴 사람 중 무엇이냐에 따라 추가 대기 시간을 더한다.

## 인터페이스
- 구현 위치: `src/server/scheduler/scheduler.ts`, 테스트 `src/server/scheduler/scheduler.test.ts`
- 형태: 순수 함수
- 공개 API:
  ```ts
  import type { GameEvent } from '../../engine/engine';

  export type ActorKind = 'cpu' | 'human' | 'offline';
  export interface DelayOptions { delayScale: number; turnTimeout: number; disconnectedDelay: number; }
  export function estimateMs(events: readonly GameEvent[]): number;
  export function delayFor(kind: ActorKind, events: readonly GameEvent[], opts: DelayOptions): number;
  ```

## 동작 규칙
1. `estimateMs` 는 400 에서 시작해 이벤트마다 더한다:
   - `spin`: `auto` 가 true 면 1400, 아니면 2800
   - `move`: `path.length × 280 + 200`
   - `msg`: 1300
   - `era`: 2600
   - `warp`: `fly` 가 true 면 2600, 아니면 900
   - `marry`, `kid`, `goal`: 1500
   - `result`: 4000
   - 그 외: 60
2. 합이 20000 을 넘으면 20000 을 돌려준다.
3. `delayFor(kind, events, opts)`: `anim = estimateMs(events) × opts.delayScale` 에
   - `cpu`: `700 × opts.delayScale` 을 더한다
   - `offline`: `opts.disconnectedDelay` 를 더한다
   - `human`: `opts.turnTimeout` 을 더한다

## 경계 조건
- 이벤트가 없으면 `estimateMs` 는 400.
- `delayScale` 이 0 이면 CPU 대기는 0, 사람 대기는 `turnTimeout` 그대로.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | `[]` | `estimateMs` | 400 |
| 2 | `[spin(auto false), move(path 3칸), msg]` | `estimateMs` | 400+2800+1040+1300 = 5540 |
| 3 | `[spin(auto true), warp(fly true), warp(fly false), kid, stat]` | `estimateMs` | 400+1400+2600+900+1500+60 = 6860 |
| 4 | `result` 이벤트 6개 | `estimateMs` | 20000 |
| 5 | `[]`, opts `{delayScale:1, turnTimeout:90000, disconnectedDelay:6000}` | `delayFor` cpu / offline / human | 1100 / 6400 / 90400 |
| 6 | `[]`, delayScale 0.01 | `delayFor('cpu')` | 11 |

## 참조
- [engine.md](../../engine/engine.md): `GameEvent` 타입
