---
pyramid: leaf
id: choice
title: 선택 창
parent: ../controls.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [입력](../controls.md) 의 「자식 구성요소」 중 `선택 창` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 선택 창

## 정의
선택 조작과 안내 문구다. 내 선택 대기면 가운데 창에 제목과 선택지 버튼(설명 포함, 비활성은 누를 수 없음)을 띄우고, 고르면 선택 조작을 보낸다. SPIN 위의 안내 문구는 내 대기면 대기 제목을, 다른 사람 대기면 누가 무엇을 하는 중인지를 보여 준다.

## 인터페이스
- 구현 위치: `src/client/controls/choice/choice.ts`, 테스트 `src/client/controls/choice/choice.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function promptText(store: Store): { text: string; wait: boolean };
  export function initChoice(ctx: ClientCtx, send: (a: Action) => void): { update(p: Pending | null): void };
  ```

## 동작 규칙
1. `promptText(store)`: `p = store.myPending()` 이 있으면 `{text: p.title, wait: false}`. 아니면 상태가 진행 중이고 대기가 있고 재생 중이 아니며(`busy` false, `queued` 0) — 대기 주체가 나면 `{text:'처리 중...', wait:true}`, 아니면 `{text: "{이름} {선택이면 '선택 중...' 아니면 '룰렛 대기 중...'}", wait:true}`. 그 외 `{text:'', wait:false}`.
2. `update(p)`: `#prompt` 글자 = promptText, 클래스 `prompt` + (wait 면 ` wait`).
3. p 가 선택 대기면: `#choice-title` = 제목, `#choice-list` 클래스 `choice-list` + (선택지가 6개 넘으면 ` grid2`), 선택지마다 `button.opt`(비활성이면 disabled, 내용은 이스케이프한 label 과 desc 가 있으면 `<small>{desc}</small>`), 누르면 창을 숨기고 `send({type:'choose', index})`. `#modal-choice` 보이기.
4. 아니면 `#modal-choice` 숨김.

## 경계 조건
- 직업 선택처럼 17개 선택지는 두 줄 격자.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 내 선택 대기 옵션 3개 중 1번 disabled | `update` | 창 보임, 버튼 3개, 둘째 disabled |
| 2 | 1 이후 | 셋째 버튼 클릭 | send `{type:'choose', index:2}`, 창 숨김 |
| 3 | 다른 사람(민수) 룰렛 대기 | `promptText` | '민수 룰렛 대기 중...', wait |
| 4 | 선택지 17개 | `update` | `grid2` 클래스 |
| 5 | busy true | `promptText` | '' |

## 참조
- [store.md](../../store/store.md): `Store`, `myPending`
- [notice.md](../../display/notice/notice.md): `esc`
