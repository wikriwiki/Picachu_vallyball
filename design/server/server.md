---
pyramid: node
id: server
title: 서버
parent: ../capstone.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생게임 온라인](../capstone.md) 의 「자식 구성요소」 중 `서버` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 서버

## 정의
Node.js 프로세스 하나로 돌아가는 게임 서버다. 빌드된 클라이언트 파일을 HTTP 로 제공하고, WebSocket 으로 들어온 클라이언트를 방에 묶어 준다. 방마다 룰 엔진으로 게임을 진행하며, 사람·CPU·끊긴 플레이어의 차례를 시간에 맞춰 처리하고 결과를 방 전체에 방송한다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "HTTP 서버"가 받은 WebSocket 메시지를 "통신 규약"으로 해석해 "방 관리자"에 넘기면, 방 관리자는 해당 "방"을 조작하고, 방은 "턴 스케줄러"로 다음 자동 진행 시각을 정한다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 통신 규약 | 클라이언트↔서버 메시지 타입, 수신 메시지 검증, 이름·아바타 정리 | [protocol.md](protocol/protocol.md) |
| 방 | 멤버·방장·모드·CPU, 게임 시작·조작 적용·상태 방송·재대결 | [room.md](room/room.md) |
| 턴 스케줄러 | 이벤트 연출 시간 추정과 사람·오프라인·CPU 별 자동 진행 지연 계산 | [scheduler.md](scheduler/scheduler.md) |
| 방 관리자 | 방 코드 발급, 메시지 라우팅, 재접속·연결 끊김 처리, 빈 방 정리 | [room-manager.md](room-manager/room-manager.md) |
| HTTP 서버 | 정적 파일 제공, `/health`, `/ws` WebSocket 연결과 하트비트 | [http.md](http/http.md) |

## 통합 방식
- 제공 인터페이스 (capstone 진입점 `src/server/main.ts` 가 호출):
  ```ts
  // src/server/server.ts
  export interface ServerOptions {
    port?: number;            // 기본: process.env.PORT 또는 3000. 0 이면 빈 포트
    staticDir?: string;       // 기본: <프로젝트>/dist/client
    delayScale?: number;      // 연출 시간 배율 (테스트에서 0.01 등), 기본 1
    turnTimeout?: number;     // 사람 차례 대기 ms, 기본 90000
    disconnectedDelay?: number; // 끊긴 사람 차례 대기 ms, 기본 6000
  }
  export interface RunningServer { port: number; close(): Promise<void>; }
  export function startServer(opts?: ServerOptions): Promise<RunningServer>;
  ```
- 자식에게 요구하는 것:
  - 통신 규약: `ClientMessage`·`ServerMessage` 유니온 타입, `LobbyInfo` 타입, `parseClientMessage(raw: string): ClientMessage | null`, `sanitizeName`, `sanitizeAvatar`, `MODES`, 상한 상수(`MAX_PLAYERS = 4`)를 공개한다. 클라이언트도 이 모듈의 타입을 import 한다.
  - 방: `Room` 클래스. 소켓을 직접 다루지 않고, 생성 시 받은 `Transport`(`send(memberId, msg)`, `broadcast(msg)`)로만 내보낸다. 게임 조작은 룰 엔진의 `createGame`·`applyAction`·`cpuAction`·`publicState` 로만 한다. 자동 진행 타이머는 턴 스케줄러의 `delayFor` 로 정한다.
  - 턴 스케줄러: 순수 함수 `estimateMs(events)` 와 `delayFor(kind, events, opts)`.
  - 방 관리자: `RoomManager` 클래스. `handle(socket, msg)`, `disconnect(socket)`, `dispose()` 를 공개한다. 소켓은 `send(text)`·`close()`·`isOpen` 만 가진 추상 `Socket` 으로 받는다. 오류는 `Error` 를 던지고, 호출자가 `error` 메시지로 바꾼다.
  - HTTP 서버: `createHttpServer({ staticDir, onSocket })`. WebSocket 연결마다 추상 `Socket` 을 만들어 `onSocket(socket)` 을 부르고, 돌려받은 핸들러(`message(text)`, `close()`)에 메시지·종료를 전달한다. `listen(port)` 은 실제 포트를, `close()` 는 종료 완료를 Promise 로 돌려준다.
- 조립: 구현 위치 `src/server/server.ts`.
  1. `RoomManager` 를 옵션과 함께 만든다.
  2. `createHttpServer` 에 `onSocket` 을 넘긴다. 핸들러의 `message(text)` 는 `parseClientMessage(text)` 가 `null` 이면 무시하고, 아니면 `rooms.handle(socket, msg)` 를 부른다. 해석이나 처리 중 던져진 오류는 `{ type: 'error', message }` 로 그 소켓에 보낸다. `close()` 는 `rooms.disconnect(socket)`.
  3. 지정 포트로 listen 한 뒤 실제 포트를 담아 `RunningServer` 를 돌려준다. `close()` 는 방 관리자를 정리하고 HTTP 서버를 닫는다.

## 수용 기준
- `startServer({ port: 0 })` 로 띄우고 `/health` 에 요청하면 `ok` 를 받는다.
- WebSocket 클라이언트 두 개가 `create`·`join` 으로 같은 방에 들어가 `start` 하면 둘 다 `state` 메시지를 받는다.
- 사람 1명과 CPU 2명인 방을 `delayScale` 을 아주 작게, 사람 대기(`turnTimeout`)를 1ms 로 두고 시작하면 아무도 조작하지 않아도 결과 발표(`phase: 'ended'`)까지 진행된다 (방은 사람이 만들어야 하므로 사람은 자동 진행으로 대신한다).
- 잘못된 JSON 이나 알 수 없는 `type` 의 메시지는 서버를 멈추지 않는다 (JSON 오류는 무시, 알 수 없는 타입은 `error` 응답).
- 게임 중 끊긴 사람이 같은 토큰으로 `join` 하면 같은 플레이어 ID 로 돌아오고 현재 상태를 받는다.

## 참조
- [engine.md](../engine/engine.md): `createGame`, `applyAction`, `cpuAction`, `publicState`, `GameEvent`, `Action`
