---
pyramid: leaf
id: connection
title: 연결
parent: ../client.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `연결` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 연결

## 정의
서버와의 WebSocket 연결 하나를 관리한다. 끊기면 점점 긴 간격으로 다시 연결하고, 다시 연결되면 탭에 저장된 세션 토큰으로 같은 방·같은 자리에 재입장을 요청한다. 연결되기 전에 보낸 메시지는 모아 두었다가 연결되면 순서대로 보낸다.

## 인터페이스
- 구현 위치: `src/client/connection/connection.ts`, 테스트 `src/client/connection/connection.test.ts`
- 형태: 팩토리 함수 + 인터페이스. 브라우저 전역 대신 주입 가능한 의존성을 받는다.
- 공개 API:
  ```ts
  import type { ClientMessage, ServerMessage } from '../../server/protocol/protocol';

  export type ConnStatus = 'connecting' | 'open' | 'closed';
  export interface Session { code: string; token: string; }
  export interface Connection {
    connect(): void;
    send(msg: ClientMessage): void;
    saveSession(code: string, token: string): void;
    clearSession(): void;
    loadSession(): Session | null;
  }
  export interface WebSocketLike {
    readyState: number;
    send(data: string): void;
    onopen: (() => void) | null;
    onmessage: ((ev: { data: string }) => void) | null;
    onclose: (() => void) | null;
  }
  export interface ConnectionDeps {            // 모두 선택. 없으면 브라우저 전역을 쓴다
    WebSocketImpl?: new (url: string) => WebSocketLike;
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; // 기본 sessionStorage
    location?: { protocol: string; host: string; search: string };  // 기본 window.location
    setTimeout?: (fn: () => void, ms: number) => unknown;
    setInterval?: (fn: () => void, ms: number) => unknown;
    now?: () => number;
  }
  export function createConnection(
    handlers: { onMessage(msg: ServerMessage): void; onStatus(status: ConnStatus): void },
    deps?: ConnectionDeps,
  ): Connection;
  export const SESSION_KEY = 'life.session';
  ```
- 상태: 현재 소켓, 보내지 못한 메시지 목록(outbox, JSON 문자열), 재시도 횟수 `retry`.

## 동작 규칙
1. 주소는 `location.protocol` 이 `https:` 면 `wss:`, 아니면 `ws:` 에 `//{location.host}/ws` 를 붙인 것이다.
2. `createConnection` 은 만들자마자 25000ms 마다 `{ type: 'ping', t: now() }` 를 `send` 하는 타이머를 건다. 소켓은 `connect()` 를 불러야 만든다.
3. `connect()`: `onStatus('connecting')` 을 부르고 새 소켓을 만든다.
4. 소켓이 열리면(`onopen`): `retry = 0`, `onStatus('open')`. 저장된 세션이 있고, 주소의 `?room=` 값이 없거나 그 값을 대문자로 바꾼 것이 세션의 `code` 와 같으면 `{ type: 'join', code, token }` 을 먼저 보낸다. 그 다음 outbox 를 쌓인 순서대로 모두 보내고 비운다.
5. 메시지를 받으면(`onmessage`) `data` 를 JSON 으로 해석해 `onMessage` 에 넘긴다. 해석에 실패하면 무시한다.
6. 소켓이 닫히면(`onclose`): `onStatus('closed')`, 지연 `min(8000, 800 × 2^retry)` ms 뒤 `connect()` 를 다시 부르도록 예약하고 `retry` 를 1 늘린다.
7. `send(msg)`: 소켓이 있고 `readyState === 1` 이면 `JSON.stringify(msg)` 를 보낸다. 아니면 `msg.type` 이 `'ping'` 이 아닐 때만 outbox 에 넣는다.
8. `saveSession(code, token)` 은 `SESSION_KEY` 에 `{"code","token"}` JSON 을 저장한다. `clearSession()` 은 그 키를 지운다. `loadSession()` 은 저장된 값을 해석해 돌려주고, 없거나 해석할 수 없으면 `null`.
9. 저장소 접근이 예외를 던지면 조용히 무시한다 (`loadSession` 은 `null`).

## 경계 조건
- 연결 전에 여러 메시지를 보내면 연결 후 보낸 순서 그대로 전송된다. 세션 재입장 join 이 항상 그보다 먼저다.
- 연속으로 끊기면 지연이 800, 1600, 3200, 6400, 8000, 8000 … ms 로 늘어난다. 한 번 열리면 다시 800 부터.
- `?room=abcd` 처럼 소문자여도 세션 코드 `ABCD` 와 같다고 본다.
- ping 은 연결이 없을 때 outbox 에 쌓이지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 가짜 WebSocket, location `{protocol:'https:', host:'a.b', search:''}` | `connect()` | 소켓 주소 `wss://a.b/ws`, onStatus 가 `connecting` 으로 불림 |
| 2 | 연결 전 | `send(create)`, `send(chat)` 후 소켓 open | 소켓에 create, chat 순서로 전송, 이후 outbox 비어 있음 |
| 3 | 세션 `{code:'ABCD', token:'t'}` 저장, search `''` | open | 첫 전송이 `{type:'join',code:'ABCD',token:'t'}` |
| 4 | 세션 `ABCD`, search `?room=wxyz` | open | join 을 보내지 않음 |
| 5 | 세션 `ABCD`, search `?room=abcd` | open | join 을 보냄 |
| 6 | 열린 소켓 | `onmessage({data:'{"type":"pong","t":1}'})`, `onmessage({data:'{bad'})` | onMessage 가 `{type:'pong',t:1}` 로 한 번만 불림 |
| 7 | 가짜 setTimeout 기록 | 소켓이 세 번 연속 닫힘 (예약 실행 포함) | 지연 800, 1600, 3200 순서로 예약, 예약이 실행될 때마다 새 소켓 생성 |
| 8 | 닫힘 두 번 후 open 한 번 | 다시 닫힘 | 지연 800 |
| 9 | 연결 없음 | `send({type:'ping',t:1})` 후 open | ping 이 전송되지 않음 |
| 10 | 저장소의 모든 메서드가 예외를 던짐 | `saveSession`, `loadSession`, `clearSession` | 예외 없음, `loadSession()` 은 `null` |
| 11 | 가짜 setInterval 기록 | `createConnection` | 25000ms 간격 타이머 1개, 실행 시 ping 전송 시도 |

## 참조
- [protocol.md](../../server/protocol/protocol.md): `ClientMessage`, `ServerMessage` 타입
