---
pyramid: leaf
id: menu
title: 메뉴
parent: ../controls.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [입력](../controls.md) 의 「자식 구성요소」 중 `메뉴` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 메뉴

## 정의
게임 화면 왼쪽의 명령 메뉴(원작: 룰렛·카드·상태·기타)와 기타 메뉴의 도구들이다. 카드는 손패 보이기/숨기기, 상태는 상태창, 기타는 도구 목록을 펼치고, 도구는 전체 지도 보기 전환, 기록·채팅 창, 규칙 창, 소리 켜기/끄기다. (룰렛 버튼은 룰렛 차지가 연결한다.)

## 인터페이스
- 구현 위치: `src/client/controls/menu/menu.ts`, 테스트 `src/client/controls/menu/menu.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function initMenu(ctx: ClientCtx): void;
  ```

## 동작 규칙
1. `#cmd-card`: `#hand` hidden 을 뒤집고, 보이면 `#cmd-card` 에 `on` 클래스.
2. `#cmd-status`: `display.openStatus()`.
3. `#cmd-other`: `#other-menu` hidden 을 뒤집는다.
4. `#btn-view`: 전체 지도 상태를 뒤집는다. 켜지면 `view.overview()`, 꺼지면 `view.zoomDefault()` 후 상태에 대기가 있으면 `view.focus(대기 주체)`. view 가 없으면 무시.
5. `#btn-log`: `display.toggleLog()`.
6. `#btn-rules`: `#modal-rules` 보이기. `#rules-close`: 숨기기.
7. `#btn-mute`: `display.sound.toggle()` 결과가 true 면 글자 '🔇', 아니면 '🔊'. 초기 글자도 현재 음소거 상태로.

## 경계 조건
- 게임 화면이 아니어도 버튼은 안전하게 동작한다 (view 없음 무시).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `#cmd-card` 클릭 두 번 | 손패 보임+on → 숨김+on 없음 |
| 2 | 가짜 view | `#btn-view` 두 번 | overview 1회, zoomDefault 1회 |
| 3 | 음소거 아님 | `#btn-mute` | 글자 '🔇' |
| 4 | — | 규칙 열기·닫기 | `#modal-rules` 보임 → 숨김 |

## 참조
- [display.md](../../display/display.md): `openStatus`, `toggleLog`, `sound`
- [view.md](../../../view/view.md): `View`
