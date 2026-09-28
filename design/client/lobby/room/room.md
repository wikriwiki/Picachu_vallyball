---
pyramid: leaf
id: room
title: 로비 화면
parent: ../lobby.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [로비](../lobby.md) 의 「자식 구성요소」 중 `로비 화면` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 로비 화면

## 정의
방에 들어간 뒤 게임 시작 전의 화면이다. 방 코드와 초대 링크 복사, 네 자리의 멤버 카드(색 점, 이름, 방장·CPU·나 표시, 끊김 흐림), 방장만 쓸 수 있는 CPU 추가·멤버 내보내기·모드 변경·시작, 그리고 나가기를 제공한다.

## 인터페이스
- 구현 위치: `src/client/lobby/room/room.ts`, 테스트 `src/client/lobby/room/room.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function initRoom(ctx: ClientCtx, deps?: { clipboard?: { writeText(s: string): Promise<void> }; location?: { origin: string; pathname: string }; history?: Pick<History, 'replaceState'> }): { render(): void };
  ```

## 동작 규칙
1. `render()`: `room = store.get('room')`, 없으면 끝. `#room-code` = 코드. 방장 여부 = `room.hostId === store.me`.
2. `#members` 를 비우고 4칸을 그린다. 멤버가 없는 칸은 `div.member.empty` 글자 '빈 자리'. 멤버 칸은 `div.member`(끊겼으면 `off` 추가) 안에 `div.dot`(배경 = 상의 색) 과 이름 + 태그(`span.tag`: 방장 '방장', CPU 'CPU', 나 '나'). 방장이 보는 화면에서 나 아닌 멤버 칸에는 `button.kick` '✕' — 누르면 `send({type:'removeMember', id})`. 이름·색은 이스케이프해 넣는다(텍스트 노드 사용).
3. `#lobby-mode` 값 = 방 모드, 방장이 아니면 비활성. `#btn-cpu` 는 방장이 아니거나 멤버 4명이면 비활성. `#btn-start` 는 방장이 아니면 비활성.
4. `#lobby-hint`: 방장이면 '친구에게 방 코드나 초대 링크를 보내세요. 최대 4명, 빈 자리는 CPU로 채울 수 있습니다.', 아니면 '방장이 게임을 시작하기를 기다리는 중...'.
5. 버튼: `#btn-copy` → `{origin}{pathname}?room={코드}` 를 클립보드에 쓰고 토스트 '초대 링크를 복사했습니다!', 실패하면 토스트로 주소를 보여 준다. `#btn-cpu` → `send({type:'addCpu'})`. `#btn-start` → `sound.unlock()`, `send({type:'start'})`. `#lobby-mode` change → `send({type:'setMode', mode: 값})`. `#btn-leave` → `send({type:'leave'})`, `connection.clearSession()`, 주소를 `pathname` 으로 바꾸고, `store.set({room: null})`, `shell.show('title')`.

## 경계 조건
- 이름에 `<b>` 가 있어도 글자 그대로 보인다.
- 방 정보가 없으면 아무것도 바꾸지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | room 코드 ABCD, 멤버 [나(방장), CPU] | `render` | 코드 표시, 멤버 칸 2 + 빈 자리 2, 나에게 방장·나 태그, CPU 칸에 kick 버튼 |
| 2 | 내가 방장 아님 | `render` | 모드·CPU·시작 비활성, 대기 안내 문구 |
| 3 | 멤버 4명 방장 | `render` | CPU 추가 비활성 |
| 4 | 이름 `<b>x</b>` | `render` | 텍스트가 `<b>x</b>` 그대로 |
| 5 | — | kick 클릭 | send removeMember |
| 6 | — | 나가기 클릭 | send leave, clearSession, 타이틀 화면 |
| 7 | 클립보드 성공 | 복사 클릭 | writeText(`https://x/?room=ABCD`), 토스트 |

## 참조
- [protocol.md](../../../server/protocol/protocol.md): `LobbyInfo`
