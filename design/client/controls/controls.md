---
pyramid: node
id: controls
title: 입력
parent: ../client.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `입력` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 입력

## 정의
게임 화면에서 사용자의 조작을 받는 부분이다. 내 차례에 SPIN 을 눌러 힘을 모았다가 떼면 룰렛 조작을, 선택지 창에서 고르면 선택 조작을, 손패의 카드를 누르면 카드 조작을 서버에 보낸다. 조작할 수 없을 때는 버튼과 창을 끄고 누가 무엇을 기다리는지 안내 문구를 보여 준다. 명령 메뉴와 도구 모음(카드·상태·지도·기록·규칙·소리)도 여기서 연결한다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "룰렛 차지"는 룰렛 조작을, "선택 창"은 선택 조작과 안내 문구를, "손패"는 카드 조작을 보내고, "메뉴"는 조작이 아닌 화면 도구를 연다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 룰렛 차지 | SPIN·명령 메뉴 룰렛·스페이스바를 누르는 동안 파워 게이지가 오르내리고, 떼면 그 힘으로 룰렛 조작 | [spin.md](spin/spin.md) |
| 선택 창 | 내 선택 대기일 때 선택지 창을 띄우고 고른 번호를 보냄, 안내 문구 | [choice.md](choice/choice.md) |
| 손패 | 내 카드 목록, 사용 가능 여부 표시, 지정 룰렛 숫자 고르기 창 | [hand.md](hand/hand.md) |
| 메뉴 | 명령 메뉴(카드·상태·기타), 기타 메뉴(전체 지도·기록·규칙·소리) | [menu.md](menu/menu.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/client/controls/controls.ts`):
  ```ts
  export interface Controls {
    updateControls(): void;   // 저장소 상태에 맞춰 SPIN·안내 문구·선택 창·손패를 다시 그림
  }
  export function initControls(ctx: ClientCtx): Controls;
  ```
- 자식에게 요구하는 것:
  - 모든 자식은 조작을 보낼 때 공통 함수 `sendAction(ctx, action)` 를 쓴다. 이 함수는 `store.sentSeq = store.state.seq` 로 두고 `{ type: 'action', action }` 을 보낸 뒤 `updateControls()` 를 부른다. `sendAction` 은 이 node 가 소유하는 `src/client/controls/send.ts` 에 둔다.
  - 룰렛 차지: `initSpin(ctx, send): { update(pending) }`. SPIN 버튼의 켜짐 여부를 맞춘다.
  - 선택 창: `initChoice(ctx, send): { update(pending) }`. 안내 문구와 선택지 창을 맞춘다.
  - 손패: `initHand(ctx, send): { update(pending) }`.
  - 메뉴: `initMenu(ctx): void`.
  - `update(pending)` 의 `pending` 은 `store.myPending()` 의 결과다 (내 조작 대기가 아니면 `null`).
- 조립: 구현 위치 `src/client/controls/controls.ts`. 자식을 모두 초기화하고, `updateControls()` 는 `const p = store.myPending()` 을 한 번 구해 룰렛 차지 → 선택 창 → 손패의 `update(p)` 를 차례로 부른다.

## 수용 기준
- 내 차례의 이동 룰렛 대기에서만 SPIN 이 켜지고, 누르고 떼면 `action{type:'spin', power}` 가 한 번 간다. 보낸 뒤에는 새 상태가 올 때까지 다시 보낼 수 없다.
- 내 선택 대기에서는 선택지 창이 뜨고, 비활성 선택지는 누를 수 없으며, 고르면 `action{type:'choose', index}` 가 간다.
- 다른 사람 차례에는 안내 문구가 "{이름} 룰렛 대기 중..." 또는 "{이름} 선택 중..." 이다.
- 이동 룰렛 전에 손패의 즉시 카드를 누르면 `action{type:'card', index}` 가, 지정 룰렛 카드를 누르고 7 을 고르면 `action{type:'card', index, number: 7}` 가 간다.

## 참조
- [engine.md](../../engine/engine.md): `Pending`, `Action`
- [protocol.md](../../server/protocol/protocol.md): `ClientMessage`
