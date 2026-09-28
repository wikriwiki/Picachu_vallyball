---
pyramid: leaf
id: room
title: 방
parent: ../server.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [서버](../server.md) 의 「자식 구성요소」 중 `방` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 방

## 정의
방 하나의 상태와 게임 진행을 맡는다. 멤버(사람·CPU), 방장, 모드를 관리하고, 방장이 시작하면 룰 엔진으로 게임을 만든다. 조작이 들어오면 엔진에 적용해 새 상태를 방 전체에 방송하고, 다음 대기 주체에 맞춰 자동 진행 타이머를 건다. 소켓은 알지 못하고, 받은 `Transport` 로만 메시지를 내보낸다.

## 인터페이스
- 구현 위치: `src/server/room/room.ts`, 테스트 `src/server/room/room.test.ts`
- 형태: 클래스
- 공개 API:
  ```ts
  import type { GameState, Action, GameEvent, Mode } from '../../engine/engine';
  import type { Avatar } from '../../data/data';
  import type { ServerMessage, LobbyInfo } from '../protocol/protocol';
  import type { DelayOptions } from '../scheduler/scheduler';

  export interface Member { id: string; token: string | null; name: string; avatar: Avatar; cpu: boolean; connected: boolean; }
  export interface Transport { send(memberId: string, msg: ServerMessage): void; broadcast(msg: ServerMessage): void; }
  export interface RoomDeps {
    randomHex(bytes: number): string;       // 기본: crypto.randomBytes(n).toString('hex')
    randomSeed(): number;                    // 기본: crypto.randomBytes(4).readUInt32LE(0)
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  }
  export const CPU_NAMES: readonly string[];   // ['CPU 하나', 'CPU 두리', 'CPU 세찌', 'CPU 네찌']
  export const CPU_SHIRTS: readonly string[];  // ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419']
  export const CPU_HAIRS: readonly string[];   // ['#2b2b2b', '#8a5a2b', '#e0b050', '#c0392b']

  export class Room {
    readonly code: string;
    members: Member[];
    hostId: string | null;
    mode: Mode;                              // 기본 'full'
    game: GameState | null;
    emptySince: number | null;               // 사람이 모두 끊긴 시각 (ms), 아니면 null
    constructor(code: string, transport: Transport, opts: DelayOptions, deps?: Partial<RoomDeps>);
    humans(): Member[];
    lobbyInfo(): LobbyInfo;
    sendLobby(): void;
    addHuman(name: string, avatar: Avatar): Member;
    addCpu(): Member;
    removeMember(id: string): Member | null;
    setMode(mode: Mode): void;
    start(): void;
    act(playerId: string, action: Action): void;
    schedule(events: readonly GameEvent[]): void;
    rematch(): void;
    dispose(): void;
  }
  ```

## 동작 규칙
1. `lobbyInfo()` 는 `{ code, hostId, mode, started: game !== null, members }` 이고, 각 멤버는 `{ id, name, avatar, cpu, connected: cpu || connected }` 만 담는다 (토큰 제외). `sendLobby()` 는 `{ type:'lobby', room: lobbyInfo() }` 를 방송한다.
2. `addHuman(name, avatar)`: 게임 중이면 `Error('이미 게임이 시작된 방입니다.')`, 멤버가 4명이면 `Error('방이 가득 찼습니다. (최대 4명)')`. 아니면 `{ id: 'u' + randomHex(4), token: randomHex(12), name, avatar, cpu: false, connected: true }` 를 추가한다. 방장이 없으면 이 멤버가 방장. 이름·아바타는 이미 정리된 값으로 받는다.
3. `addCpu()`: 게임 중이면 `Error('게임 중에는 추가할 수 없습니다.')`, 4명이면 `Error('방이 가득 찼습니다.')`. `k` = 현재 CPU 수, `h = k % 4` 일 때 `{ id: 'c' + randomHex(4), token: null, name: CPU_NAMES[h], cpu: true, connected: true, avatar: { ...AVATAR_DEFAULT, shirt: CPU_SHIRTS[h], hairStyle: h, hair: CPU_HAIRS[h] } }` 를 추가한다.
4. `removeMember(id)`: 게임 중이면 `Error('게임 중에는 할 수 없습니다.')`. 그 멤버를 빼고 돌려준다. 없으면 `null`.
5. `setMode(mode)`: 게임 중이면 아무것도 하지 않는다.
6. `start()`: 이미 게임이 있으면 `Error('이미 시작했습니다.')`, 멤버가 없으면 `Error('플레이어가 없습니다.')`. 멤버 순서대로 `{ id, name, avatar, cpu }` 로 `createGame({ players, mode, seed: randomSeed() })` 를 부르고, `sendLobby()` 후 `pushState(events)` 한다.
7. `pushState(events)`(내부): `{ type:'state', state: publicState(game), events, seq: game.seq }` 를 방송하고 `schedule(events)`.
8. `act(playerId, action)`: 게임이 없으면 `Error('게임이 시작되지 않았습니다.')`. `applyAction(game, playerId, action)` 의 새 상태로 `game` 을 바꾸고 `pushState(events)`. 엔진의 `RuleError` 는 그대로 던진다 (상태는 바뀌지 않음).
9. `schedule(events)`: 기존 타이머를 지운다. 게임이 없거나, 끝났거나, 대기가 없으면 여기서 끝. 대기 주체 멤버가 CPU(또는 멤버 목록에 없음)면 `cpu`, 끊긴 사람이면 `offline`, 접속 중인 사람이면 `human` 으로 `delayFor` 를 구해 타이머를 건다. 타이머가 울렸을 때 `game.seq` 가 예약할 때와 같으면 `cpuAction(game)` 을 구해 `act(대기 주체, 조작)` 한다. 이 호출이 오류를 던지면 삼킨다 (방이 멈추지 않게).
10. `rematch()`: 게임이 끝난 상태가 아니면 아무것도 하지 않는다. 타이머를 지우고, `game = null`, CPU 이거나 접속 중인 멤버만 남긴 뒤 `sendLobby()` 와 `{ type:'backToLobby' }` 방송.
11. `humans()` 는 CPU 가 아닌 멤버. `dispose()` 는 타이머를 지운다.

## 경계 조건
- 5번째 멤버 추가는 사람·CPU 모두 거절된다.
- CPU 가 5번째로 추가될 일은 없지만, 이름·색은 `k % 4` 로 순환한다.
- 이전 seq 로 예약된 타이머는 그 사이 누가 조작했으면 아무것도 하지 않는다.
- `start()` 뒤 첫 대기가 CPU 면 사람 개입 없이 타이머로 진행된다.

## 테스트 케이스
가짜 `Transport`(보낸 메시지 기록), 결정적 `randomHex`·`randomSeed`, 가짜 타이머(예약 목록, 수동 실행)로 검사한다.

| # | Given | When | Then |
|---|---|---|---|
| 1 | 빈 방 | `addHuman('a', av)` | 멤버 1, id `u…`, token 24자, `hostId` 가 그 id |
| 2 | 사람 1 + CPU 3 | `addHuman` / `addCpu` | 각각 가득 참 오류 |
| 3 | 사람 1 | `addCpu()` 두 번 | 이름 'CPU 하나', 'CPU 두리', 셔츠 #ff6b6b, #4dabf7 |
| 4 | 사람 1 + CPU 1 | `lobbyInfo()` | 멤버에 token 없음, CPU 의 connected true |
| 5 | 사람 1 + CPU 1 | `start()` | lobby(started true)·state 방송, 대기 주체에 맞는 타이머 1개 |
| 6 | CPU 만 2명, delayScale 0.01 | `start()` 후 타이머를 계속 실행 | 결국 `game.phase === 'ended'`, 마지막 방송 state 의 phase ended |
| 7 | 게임 중, 대기 주체 사람 p | `act(p, spin)` | state 방송, seq 1 증가 |
| 8 | 게임 중 | `act('남', spin)` | 엔진 RuleError, 방송 없음 |
| 9 | 타이머 예약 후 사람이 먼저 조작 | 옛 타이머 실행 | 추가 조작 없음 |
| 10 | 끝난 게임, 멤버 [사람 접속, 사람 끊김, CPU] | `rematch()` | 멤버 2명(접속 사람, CPU), game null, lobby·backToLobby 방송 |
| 11 | 게임 중 | `addHuman` / `removeMember` / `setMode('kids')` | 오류 / 오류 / mode 그대로 |

## 참조
- [engine.md](../../engine/engine.md): `createGame`, `applyAction`, `cpuAction`, `publicState`, `RuleError`
- [data.md](../../data/data.md): `AVATAR_DEFAULT`, `Avatar`
- [protocol.md](../protocol/protocol.md): `ServerMessage`, `LobbyInfo`
- [scheduler.md](../scheduler/scheduler.md): `delayFor`, `DelayOptions`
