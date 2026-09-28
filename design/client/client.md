---
pyramid: node
id: client
title: 클라이언트
parent: ../capstone.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생게임 온라인](../capstone.md) 의 「자식 구성요소」 중 `클라이언트` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 클라이언트

## 정의
브라우저에서 돌아가는 앱이다. 타이틀·로비·게임 화면의 2D UI 를 보여 주고, 사용자의 입력을 서버에 조작 메시지로 보내며, 서버가 방송한 상태와 이벤트를 받아 3D 화면과 HUD 로 차례대로 재생한다. 규칙 판정은 하지 않는다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "연결"이 서버 메시지를 "상태 저장소"에 넣으면, "재생"이 이벤트를 "표시"와 3D 화면으로 풀어내고, 사용자는 "화면 골격" 위의 "로비"와 "입력"으로 다시 조작을 보낸다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 연결 | WebSocket 연결, 자동 재연결, 세션 토큰 저장과 재입장 | [connection.md](connection/connection.md) |
| 상태 저장소 | 내 ID, 방 정보, 반영된 게임 상태, 연출 중 표시 상태, 보낸 조작 번호 | [store.md](store/store.md) |
| 화면 골격 | index.html 구조, 스타일, 화면 전환 | [shell.md](shell/shell.md) |
| 로비 | 타이틀(프로필·아바타·방 만들기/참가)과 로비(멤버·방장 조작) 화면 | [lobby.md](lobby/lobby.md) |
| 재생 | 받은 상태·이벤트를 큐에 쌓고 이벤트별 연출을 순서대로 실행 | [playback.md](playback/playback.md) |
| 표시 | HUD, 플레이어 목록, 상태창, 기록·채팅, 메시지·배너·토스트, 효과음, 결과 발표 | [display.md](display/display.md) |
| 입력 | 룰렛 차지, 선택지 창, 카드 손패, 명령 메뉴·도구 모음 | [controls.md](controls/controls.md) |

## 통합 방식
- 제공 인터페이스 (capstone 이 요구한 진입점에서 호출됨):
  ```ts
  // src/client/client.ts
  export function startClient(doc: Document): void;
  ```
  `src/client/main.ts`(capstone 소유)는 `startClient(document)` 만 호출한다.
- 자식에게 요구하는 것:
  - 연결: `createConnection({ onMessage, onStatus }): Connection`. `Connection` 은 `connect()`, `send(msg: ClientMessage)`, `saveSession(code, token)`, `clearSession()` 을 가진다. 메시지 형식은 서버의 통신 규약을 따른다.
  - 상태 저장소: `createStore(): Store`. 다른 자식은 저장소를 통해서만 공유 상태를 읽고 쓴다. 저장소는 값이 바뀌면 구독자에게 알린다.
  - 화면 골격: `initShell(doc): Shell`. 화면 전환 `show('title' | 'lobby' | 'game')` 과, 다른 자식이 쓰는 DOM 요소 조회 `el(id)` 를 제공한다. 모든 DOM id 는 화면 골격이 정의한다.
  - 로비: `initLobby(ctx)`. 타이틀·로비 화면의 버튼을 연결하고, `renderLobby()` 를 공개한다.
  - 재생: `createPlayback(ctx)`. `enqueue(state, events)` 로 받은 상태를 차례대로 재생한다. 처음 상태가 오면 3D 화면을 만든다.
  - 표시: `createDisplay(ctx)`. HUD·목록·메시지·효과음·결과 발표를 그리는 함수들을 공개한다. 재생과 입력이 이를 호출한다.
  - 입력: `initControls(ctx)`. 조작 가능할 때만 조작 메시지를 보내고, `updateControls()` 를 공개한다.
  - 공통 `ctx`: `ClientCtx = { doc, shell, store, connection, display, lobby, controls, getView(): View | null, ensureView(): Promise<View> }`. 자식끼리는 `ctx` 로만 서로를 부른다. `ClientCtx` 타입은 이 node 가 소유하는 `src/client/ctx.ts` 에 둔다. 자식 테스트가 함께 쓰는 도구(실제 `index.html` 로 jsdom 문서 만들기, 가짜 ctx·view)는 이 node 가 소유하는 `src/client/testkit.ts` 에 두며 테스트에서만 import 한다 (타입만 담고, 자식은 `import type` 으로만 쓴다). `lobby`·`controls` 는 나중에 만들어지므로 만들어지기 전에는 부르지 않는다.
- 조립: 구현 위치 `src/client/client.ts`.
  1. 화면 골격 → 상태 저장소 → 연결(아직 connect 하지 않음) → 표시 → 재생 → 로비 → 입력 순서로 만든다.
  2. `ensureView()` 는 처음 호출될 때 3D 화면 모듈을 동적 import 해 `createView(canvas, rouletteCanvas, { tick: sound.tick, ding: sound.ding })` 로 만들고, 이후에는 같은 인스턴스를 돌려준다.
  3. 서버 메시지 분기 (`onMessage`):
     - `joined` → 저장소에 내 ID 저장, 세션 저장, 주소를 `?room=코드` 로 바꾼다.
     - `lobby` → 저장소에 방 정보 저장. 게임 전이면 게임 상태를 비우고 로비 화면 표시, 게임 중이면 플레이어 목록만 다시 그린다.
     - `state` → 재생의 `enqueue`.
     - `backToLobby` → 결과 창을 닫고 재생 큐와 게임 상태를 비운 뒤 로비 화면.
     - `chat` → 표시의 기록에 추가, 기록 창이 닫혀 있으면 토스트.
     - `error` → 오류 토스트. "존재하지 않는 방" 오류면 세션을 지우고 타이틀로. 보낸 조작 번호를 초기화하고 `updateControls()`.
     - `kicked` → 세션을 지우고 토스트 후 타이틀.
  4. `onStatus` → 연결 상태 표시를 갱신하고, 방에 있는 중 끊기면 토스트.
  5. 재생이 한 묶음을 끝낼 때마다 `updateControls()` 를 부른다.
  6. 주소에 `?room=코드` 가 있으면 코드 입력칸을 채운 뒤 `connect()`.

## 수용 기준
- 서버에 연결하고 방을 만들면 로비에 방 코드와 내 이름(방장 표시)이 보인다.
- 두 번째 탭에서 코드로 참가하면 두 탭의 로비 멤버 목록이 모두 두 명이 된다.
- 방장이 시작하면 두 탭 모두 게임 화면으로 바뀌고, 내 차례에만 SPIN 버튼이 켜진다.
- 게임 도중 새로고침하면 같은 자리로 재입장해 현재 상태가 보인다.
- 서버가 보낸 이벤트는 받은 순서대로 재생되고, 재생이 끝난 뒤의 HUD 값은 마지막 상태와 같다.

## 참조
- [server.md](../server/server.md): 통신 규약(`ClientMessage`, `ServerMessage`)
- [engine.md](../engine/engine.md): `PublicState`, `GameEvent`, `Pending`, `Action` 타입과 `salaryOf`
- [data.md](../data/data.md): 시대·직업·카드 등 표시용 데이터, `BOARD`, `stepsToPayday`, `formatMoney`
- [view.md](../view/view.md): `createView`, `View`, 아바타 미리보기
