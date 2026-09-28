---
pyramid: node
id: lobby
title: 로비
parent: ../client.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `로비` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 로비

## 정의
게임에 들어가기 전의 두 화면이다. 타이틀 화면에서 닉네임·아바타·모드를 정해 방을 만들거나 코드로 참가하고, 로비 화면에서 방 코드와 멤버를 보며 방장이 CPU 추가·내보내기·모드 변경·시작을 한다.

## 관계
- 분해 축: 단계(step-of)
- 관계 문장: "타이틀 화면"에서 프로필을 정해 방에 들어가면 "로비 화면"에서 시작을 기다린다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 타이틀 화면 | 프로필(닉네임·아바타) 저장과 편집, 방 만들기·참가, 연결 상태 표시 | [title.md](title/title.md) |
| 로비 화면 | 방 코드·초대 링크, 멤버 목록, 방장 조작(CPU 추가·내보내기·모드·시작), 나가기 | [room.md](room/room.md) |

## 통합 방식
- 제공 인터페이스 (클라이언트 「통합 방식」의 로비 계약):
  ```ts
  // src/client/lobby/lobby.ts
  export interface Lobby {
    renderLobby(): void;                 // 저장소의 room 으로 로비 화면을 다시 그림
    setConnStatus(status: ConnStatus): void; // 타이틀 화면의 연결 상태 문구
    fillCodeFromUrl(search: string): void;   // ?room= 값을 코드 입력칸에
  }
  export function initLobby(ctx: ClientCtx): Lobby;   // ClientCtx: src/client/ctx.ts (부모 소유 타입)
  ```
- 자식에게 요구하는 것:
  - 타이틀 화면: `initTitle(ctx): { setConnStatus(status), fillCodeFromUrl(search) }`. 버튼 연결과 아바타 미리보기를 맡는다.
  - 로비 화면: `initRoom(ctx): { render(): void }`. 버튼 연결과 멤버 목록 그리기를 맡는다.
- 조립: 구현 위치 `src/client/lobby/lobby.ts`. `initTitle` 과 `initRoom` 을 차례로 부르고, `renderLobby` 는 `render` 에, 나머지는 타이틀 쪽 함수에 넘긴다.

## 수용 기준
- 타이틀에서 이름 "민수"로 방을 만들면 서버에 `create` 가 한 번 가고, `lobby` 메시지를 받은 뒤 로비 화면에 방 코드와 "민수 [방장][나]" 가 보인다.
- 방장이 아닌 사람의 로비에서는 CPU 추가·시작·모드 선택이 꺼져 있다.
- 로비에서 나가기를 누르면 `leave` 를 보내고 세션을 지운 뒤 타이틀 화면이 된다.

## 참조
- [connection.md](../connection/connection.md): `ConnStatus`
