---
pyramid: leaf
id: http
title: HTTP 서버
parent: ../server.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [서버](../server.md) 의 「자식 구성요소」 중 `HTTP 서버` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# HTTP 서버

## 정의
Node.js HTTP 서버와 그 위의 WebSocket 서버다. 빌드된 클라이언트 파일을 정적으로 제공하고, 상태 확인용 `/health` 에 답하며, `/ws` 로 들어온 WebSocket 연결을 추상 `Socket` 으로 감싸 호출자에게 넘긴다. 응답이 없는 연결은 하트비트로 정리한다. 게임 규칙이나 방은 알지 못한다.

## 인터페이스
- 구현 위치: `src/server/http/http.ts`, 테스트 `src/server/http/http.test.ts`
- 형태: 팩토리 함수
- 공개 API:
  ```ts
  import type { Socket } from '../room-manager/room-manager';

  export interface SocketHandlers { message(text: string): void; close(): void; }
  export interface HttpServerOptions {
    staticDir: string;                                  // 제공할 폴더 (index.html 포함)
    onSocket(socket: Socket): SocketHandlers;
    heartbeatMs?: number;                               // 기본 20000
  }
  export interface HttpServer {
    listen(port: number): Promise<number>;              // 실제로 열린 포트
    close(): Promise<void>;
  }
  export function createHttpServer(opts: HttpServerOptions): HttpServer;
  export const CONTENT_TYPES: Readonly<Record<string, string>>;
  ```
- 의존: `node:http`, `node:fs`, `node:path`, `ws` 의 `WebSocketServer`.

## 동작 규칙
1. 요청 경로는 URL 의 pathname 을 `decodeURIComponent` 한 값이다. 해석에 실패하면 400.
2. `/health` 는 200, `content-type: text/plain`, 본문 `ok`.
3. `/` 는 `/index.html` 로 바꾼다.
4. 파일 경로 = `path.resolve(staticDir, '.' + 경로)`. 이 경로가 `staticDir` 안(`staticDir + path.sep` 로 시작)이 아니면 404.
5. 파일이 없거나 파일이 아니면 404, 본문 `not found`. 있으면 200 과 함께 스트림으로 보낸다.
6. `content-type` 은 확장자별 `CONTENT_TYPES`: `.html` `text/html; charset=utf-8`, `.js` `text/javascript; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.json` `application/json`, `.png` `image/png`, `.svg` `image/svg+xml`, `.ico` `image/x-icon`, `.woff2` `font/woff2`, 그 외 `application/octet-stream`.
7. `cache-control`: 경로가 `/assets/` 로 시작하면 `public, max-age=31536000, immutable`(Vite 해시 파일), 아니면 `no-cache`.
8. WebSocket 서버는 같은 HTTP 서버의 `/ws` 경로, 메시지 최대 16KB(`maxPayload: 16384`).
9. 연결마다 `Socket` 을 만든다: `send(text)` 는 `readyState === OPEN` 일 때만 보낸다, `close()` 는 연결을 닫는다, `isOpen` 은 `readyState === OPEN`. `onSocket(socket)` 이 돌려준 핸들러에 메시지(문자열로 변환)와 종료를 전달한다.
10. 하트비트: 연결마다 `alive = true` 로 시작하고 pong 을 받으면 true. `heartbeatMs` 마다 모든 연결을 돌며 `alive` 가 false 면 `terminate()`, 아니면 false 로 바꾸고 `ping()`.
11. `listen(port)` 은 열린 실제 포트를 돌려준다 (0 이면 임의 포트). `close()` 는 하트비트를 멈추고, 모든 WebSocket 을 닫고, HTTP 서버를 닫은 뒤 resolve.

## 경계 조건
- `/../package.json`, `/%2e%2e/secret` 같은 경로 이탈은 404.
- 폴더 경로 요청은 404 (폴더 안 index.html 로 넘기지 않는다, `/` 만 예외).
- `onSocket` 핸들러의 `message` 가 예외를 던져도 서버는 계속 돈다 (예외는 잡아서 무시).

## 테스트 케이스
임시 폴더에 `index.html`(내용 `<h1>hi</h1>`), `assets/a.js` 를 만들고 `listen(0)` 으로 연다.

| # | Given | When | Then |
|---|---|---|---|
| 1 | 서버 | `GET /health` | 200 `ok` |
| 2 | 서버 | `GET /` | 200, html content-type, `no-cache`, 본문 `<h1>hi</h1>` |
| 3 | 서버 | `GET /assets/a.js` | 200, js content-type, `immutable` 캐시 |
| 4 | 서버 | `GET /nope.txt` | 404 |
| 5 | 서버 | `GET /../package.json` (원시 경로로 요청) | 404 |
| 6 | 서버 | `GET /%E0%A4%A` | 400 |
| 7 | onSocket 이 받은 메시지를 되돌려 보내는 핸들러 | ws 클라이언트가 `/ws` 로 `"hi"` 전송 | `"hi"` 수신 |
| 8 | 연결된 ws 클라이언트 | 클라이언트가 닫음 | 핸들러 `close` 1회 |
| 9 | heartbeatMs 50, pong 에 답하지 않는 연결 | 150ms 대기 | 서버 쪽에서 연결 종료 |
| 10 | 열린 서버 | `close()` | resolve, 이후 요청은 연결 거부 |

## 참조
- [room-manager.md](../room-manager/room-manager.md): `Socket` 인터페이스
