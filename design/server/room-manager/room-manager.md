---
pyramid: leaf
id: room-manager
title: 방 관리자
parent: ../server.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [서버](../server.md) 의 「자식 구성요소」 중 `방 관리자` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 방 관리자

## 정의
서버의 모든 방과 연결을 관리한다. 방 코드를 발급해 방을 만들고, 소켓과 (방, 멤버)를 묶어 두며, 해석된 클라이언트 메시지를 종류에 따라 방에 전달한다. 같은 토큰으로 돌아온 사람을 원래 자리에 다시 앉히고, 연결이 끊긴 사람을 표시하며, 사람이 모두 떠난 방을 일정 시간 뒤 정리한다.

## 인터페이스
- 구현 위치: `src/server/room-manager/room-manager.ts`, 테스트 `src/server/room-manager/room-manager.test.ts`
- 형태: 클래스
- 공개 API:
  ```ts
  import type { ClientMessage } from '../protocol/protocol';
  import { Room, type Member, type RoomDeps } from '../room/room';
  import type { DelayOptions } from '../scheduler/scheduler';

  export interface Socket { send(text: string): void; close(): void; readonly isOpen: boolean; }
  export interface ManagerDeps extends RoomDeps {
    randomInt(max: number): number;          // 기본: crypto.randomInt
    now(): number;                           // 기본: Date.now
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  }
  export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  export const EMPTY_ROOM_TTL = 10 * 60 * 1000;
  export class RoomManager {
    readonly rooms: Map<string, Room>;
    constructor(opts: DelayOptions, deps?: Partial<ManagerDeps>);
    handle(socket: Socket, msg: ClientMessage): void;   // 오류는 Error 로 던짐
    disconnect(socket: Socket): void;
    collect(): void;                                    // 빈 방 정리 (주기 실행)
    dispose(): void;
  }
  ```
- 상태: `rooms`(코드 → 방), `sockets`(소켓 → `{ room, member }`), 멤버 ID → 소켓, 정리 타이머.
- 방의 `Transport` 는 매니저가 만든다: `send(memberId, msg)` 는 그 멤버의 소켓이 열려 있으면 `JSON.stringify(msg)` 를 보낸다, `broadcast(msg)` 는 방의 모든 멤버에게 `send`.

## 동작 규칙
1. 생성 시 60000ms 마다 `collect()` 를 부르는 타이머를 건다.
2. 방 코드: `CODE_CHARS` 에서 `randomInt` 로 4글자를 뽑고, 이미 있는 코드면 다시 뽑는다.
3. `bind(socket, room, member)`(내부): 소켓을 묶고, 그 소켓에 `{type:'joined', code, playerId, token}` 를 보내고, `room.sendLobby()`. 게임 중이면 그 소켓에 `{type:'state', state: publicState(game), events: [], seq}` 를 보낸다.
4. 방 없이 처리하는 메시지:
   - `create`: 이미 묶인 소켓이면 먼저 `leave`. 새 코드로 방을 만들고 `mode` 를 정한 뒤 `addHuman(name, avatar)` → `bind`.
   - `join`: 코드의 방이 없으면 `Error('존재하지 않는 방 코드입니다.')`. 묶인 소켓이면 먼저 `leave`. `token` 이 있고 같은 토큰의 사람 멤버가 있으면: 그 멤버의 이전 소켓이 이 소켓과 다르면 묶음을 풀고 닫는다, 멤버를 이 소켓으로 바꾸고 `connected = true`, `room.emptySince = null`, `bind`, 게임 중이면 `room.schedule([])`. 토큰이 없거나 맞는 멤버가 없으면 `addHuman` → `emptySince = null` → `bind`.
   - `chat`: 묶이지 않았으면 무시. 글자가 비어 있지 않으면 `{type:'chat', from: 멤버 이름, pid: 멤버 id, text}` 를 방에 방송.
   - `leave`: `leave(socket)`.
   - `ping`: 그 소켓에 `{type:'pong', t}`.
5. 그 외 메시지는 묶여 있어야 한다. 아니면 `Error('방에 들어가 있지 않습니다.')`. 방장 여부 = `room.hostId === member.id`.
   - `addCpu`: 방장만 (`Error('방장만 할 수 있습니다.')`). `addCpu()` 후 `sendLobby()`.
   - `removeMember`: 방장만. 대상이 없거나 자기 자신이면 무시. 게임 중이면 방의 오류가 그대로 던져진다. 뺀 멤버에게 소켓이 있으면 `{type:'kicked'}` 를 보내고 묶음을 푼다. `sendLobby()`.
   - `setMode`: 방장만. `setMode` 후 `sendLobby()`.
   - `start`: 방장만 (`Error('방장만 시작할 수 있습니다.')`). `room.start()`.
   - `action`: `room.act(member.id, action)`.
   - `rematch`: 방장만. `room.rematch()`.
6. `leave(socket)`(내부): 묶이지 않았으면 무시. 게임 중이면 `disconnect(socket)` 와 같다. 아니면 묶음을 풀고 멤버를 방에서 빼고, 방장이었으면 남은 첫 사람을 방장으로 (없으면 `null`). 사람이 아무도 없으면 방을 `dispose` 하고 지운다. 아니면 `sendLobby()`.
7. `disconnect(socket)`: 묶이지 않았으면 무시. 게임 전이면 `leave` 와 같다. 게임 중이면 묶음을 풀고, 그 멤버의 현재 소켓이 이 소켓일 때만: `connected = false`, 소켓 없음, 방장이었으면 접속 중인 다른 사람에게 방장을 넘김, 접속 중인 사람이 없으면 `emptySince = now()`, `sendLobby()`, `room.schedule([])`.
8. `collect()`: `emptySince` 가 있고 `now() − emptySince > EMPTY_ROOM_TTL` 인 방을 `dispose` 하고 지운다.
9. `dispose()`: 정리 타이머를 멈추고 모든 방을 `dispose`.

## 경계 조건
- 이미 다른 방에 있는 소켓이 `create`/`join` 하면 이전 방에서 먼저 나간다 (게임 중이면 끊김 처리).
- 같은 토큰으로 두 탭이 들어오면 나중 탭이 자리를 가져가고 이전 탭의 소켓은 닫힌다.
- 게임 중 새 사람이 토큰 없이 `join` 하면 방의 `addHuman` 오류(이미 시작)가 그대로 던져진다.
- 방장이 게임 중 끊겼는데 접속 중인 사람이 없으면 방장은 그대로 둔다.

## 테스트 케이스
가짜 `Socket`(보낸 문자열 기록, `isOpen` true), 결정적 난수, 가짜 타이머, 조절 가능한 `now` 로 검사한다.

| # | Given | When | Then |
|---|---|---|---|
| 1 | 빈 매니저, randomInt 가 A,B,C,D 순서 | 소켓 s1 `create` | 방 `ABCD`, s1 에 joined → lobby 순서로 수신 |
| 2 | 방 `ABCD` 있음, randomInt 가 A,B,C,D,W,X,Y,Z | 두 번째 `create` | 두 번째 방 코드 `WXYZ` |
| 3 | 방 `ABCD` | s2 `join ABCD` | 두 소켓 모두 멤버 2명 lobby 수신 |
| 4 | 없는 코드 | `join QQQQ` | `Error('존재하지 않는 방 코드입니다.')` |
| 5 | s2 는 방장이 아님 | s2 `addCpu` / `start` | 각각 방장 오류 |
| 6 | 게임 중 s2 끊김 | `disconnect(s2)` | 멤버 connected false, lobby 방송 |
| 7 | 6 이후 | 새 소켓 s3 `join ABCD token(s2)` | 같은 playerId 로 joined, s3 에 state 수신, connected true |
| 8 | 같은 토큰으로 s4 가 또 join | — | s3 의 `close()` 호출, s4 가 묶임 |
| 9 | 게임 전, 방장 s1 이 `leave` | — | s2 가 방장, s2 에 lobby |
| 10 | 게임 중 모두 끊김, now 를 10분+1ms 뒤로 | `collect()` | 방 삭제 |
| 11 | 방장 s1, 멤버 s2 | s1 `removeMember s2` | s2 에 kicked, 방 멤버 1명 |
| 12 | 묶이지 않은 소켓 | `start` | `Error('방에 들어가 있지 않습니다.')` |
| 13 | 묶인 소켓 | `ping t=5` / `chat '  '` | pong t 5 / 방송 없음 |

## 참조
- [room.md](../room/room.md): `Room`, `Member`, `RoomDeps`
- [protocol.md](../protocol/protocol.md): `ClientMessage`, `ServerMessage`
- [engine.md](../../engine/engine.md): `publicState`
- [scheduler.md](../scheduler/scheduler.md): `DelayOptions`
