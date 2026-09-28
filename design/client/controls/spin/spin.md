---
pyramid: leaf
id: spin
title: 룰렛 차지
parent: ../controls.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [입력](../controls.md) 의 「자식 구성요소」 중 `룰렛 차지` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 룰렛 차지

## 정의
룰렛 조작이다. 내 룰렛 대기일 때 SPIN 버튼(또는 명령 메뉴의 룰렛 버튼, 스페이스바)을 누르고 있으면 파워 게이지가 0↔1 을 오르내리며 3D 룰렛이 빨라지고, 떼는 순간의 힘으로 룰렛 조작을 보낸다.

## 인터페이스
- 구현 위치: `src/client/controls/spin/spin.ts`, 테스트 `src/client/controls/spin/spin.test.ts` (jsdom, 가짜 시계·rAF)
- 공개 API:
  ```ts
  export function powerAt(seconds: number): number;   // 0.5 − 0.5·cos(3.2·t)
  export function initSpin(ctx: ClientCtx, send: (a: Action) => void, deps?: { now?: () => number; raf?: (fn: () => void) => void }): { update(p: Pending | null): void };
  ```

## 동작 규칙
1. `update(p)`: `#btn-spin.disabled = !(p && p.type === 'spin')`.
2. 차지 시작 (`#btn-spin`·`#cmd-roulette` 의 pointerdown, 입력칸에 초점이 없을 때의 스페이스 keydown(반복 아님)): 기본 동작을 막는다. `store.myPending()` 이 룰렛 대기가 아니거나 이미 차지 중이면 무시. `sound.unlock()`, `#btn-spin` 에 `charging` 클래스, 시작 시각을 기록하고 매 프레임 `power = powerAt(경과 초)` 로 `#power-fill` 너비 `{round(power×100)}%`, `view.roulette.charge(power)`.
3. 차지 끝 (같은 버튼들의 pointerup·pointerleave, 스페이스 keyup): 차지 중이 아니면 무시. 차지를 멈추고 `charging` 제거, `view.roulette.release()`, 400ms 뒤 게이지 0%, `send({type:'spin', power})`.

## 경계 조건
- 텍스트 입력칸(채팅 등)에 초점이 있으면 스페이스바는 무시한다.
- 보낸 뒤에는 저장소의 `sentSeq` 로 인해 `myPending()` 이 null 이 되어 다시 차지할 수 없다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `powerAt(0)`, `powerAt(π/3.2)` | 0, 1 |
| 2 | 내 룰렛 대기 | `update(p)` | 버튼 켜짐 |
| 3 | 선택 대기 | `update(p)` | 버튼 꺼짐 |
| 4 | 내 룰렛 대기, 시계 0 → 0.49s | pointerdown → pointerup | send `{type:'spin', power: powerAt(0.49)}` 1회, release 호출 |
| 5 | 대기 없음 | pointerdown → pointerup | send 없음 |
| 6 | 채팅 입력칸 초점 | 스페이스 keydown/up | send 없음 |

## 참조
- [engine.md](../../../engine/engine.md): `Pending`, `Action`
- [view.md](../../../view/view.md): `RouletteView`
