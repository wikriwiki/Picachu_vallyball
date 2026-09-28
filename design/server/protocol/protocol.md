---
pyramid: leaf
id: protocol
title: 통신 규약
parent: ../server.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [서버](../server.md) 의 「자식 구성요소」 중 `통신 규약` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 통신 규약

## 정의
클라이언트와 서버가 WebSocket 으로 주고받는 메시지의 형식이다. 서버가 받은 문자열을 해석·검증해 안전한 `ClientMessage` 로 바꾸는 함수와, 사용자가 보낸 이름·아바타를 정리하는 함수를 함께 둔다. 클라이언트도 이 모듈의 타입을 그대로 쓴다.

## 인터페이스
- 구현 위치: `src/server/protocol/protocol.ts`, 테스트 `src/server/protocol/protocol.test.ts`
- 형태: 타입 + 순수 함수. 런타임 의존은 데이터의 `AVATAR_DEFAULT` 뿐 (엔진은 타입만 import).
- 공개 API:
  ```ts
  import type { Action, PublicState, GameEvent, Mode } from '../../engine/engine';
  import type { Avatar } from '../../data/data';

  export const MODES: readonly Mode[];          // ['full', 'adult', 'kids']
  export const MAX_PLAYERS = 4;
  export interface MemberInfo { id: string; name: string; avatar: Avatar; cpu: boolean; connected: boolean; }
  export interface LobbyInfo { code: string; hostId: string | null; mode: Mode; started: boolean; members: MemberInfo[]; }

  export type ClientMessage =
    | { type: 'create'; name: string; avatar: Avatar; mode: Mode }
    | { type: 'join'; code: string; token?: string; name: string; avatar: Avatar }
    | { type: 'chat'; text: string }
    | { type: 'leave' }
    | { type: 'ping'; t: number }
    | { type: 'addCpu' }
    | { type: 'removeMember'; id: string }
    | { type: 'setMode'; mode: Mode }
    | { type: 'start' }
    | { type: 'action'; action: Action }
    | { type: 'rematch' };

  export type ServerMessage =
    | { type: 'joined'; code: string; playerId: string; token: string }
    | { type: 'lobby'; room: LobbyInfo }
    | { type: 'state'; state: PublicState; events: GameEvent[]; seq: number }
    | { type: 'chat'; from: string; pid: string; text: string }
    | { type: 'error'; message: string }
    | { type: 'kicked' }
    | { type: 'backToLobby' }
    | { type: 'pong'; t: number };

  export class ProtocolError extends Error {}
  export function parseClientMessage(raw: string): ClientMessage | null;
  export function sanitizeName(name: unknown): string;
  export function sanitizeAvatar(avatar: unknown): Avatar;
  ```

## 동작 규칙
1. `parseClientMessage(raw)`: JSON 해석에 실패하거나, 결과가 객체가 아니거나, `type` 이 문자열이 아니면 `null`.
2. `type` 이 위 11가지가 아니면 `ProtocolError('알 수 없는 요청')` 을 던진다.
3. 종류별 정리 (입력의 다른 필드는 버린다):
   - `create`: `name = sanitizeName(name)`, `avatar = sanitizeAvatar(avatar)`, `mode` 는 `MODES` 에 있으면 그대로, 없으면 `'full'`.
   - `join`: `code = String(code ?? '').trim().toUpperCase()`, `token` 은 비어 있지 않은 문자열일 때만 넣는다, `name`·`avatar` 는 create 와 같이 정리.
   - `chat`: `text = String(text ?? '').slice(0, 120).trim()`.
   - `ping`: `t` 가 유한한 수면 그대로, 아니면 0.
   - `removeMember`: `id = String(id ?? '')`.
   - `setMode`: `mode` 가 `MODES` 에 없으면 `ProtocolError('알 수 없는 모드입니다.')`.
   - `action`: `action.type` 이 `spin` 이면 `{ type:'spin', power }`(power 는 유한한 수, 아니면 0), `choose` 면 `{ type:'choose', index }`(정수로 내림, 수가 아니면 0), `card` 면 `{ type:'card', index }` 에 `number` 가 수면 정수로 내린 `number` 를 덧붙인다. 그 외면 `ProtocolError('알 수 없는 조작입니다.')`.
   - `leave`, `addCpu`, `start`, `rematch`: `{ type }` 만.
4. `sanitizeName(n)`: `String(n ?? '')` 에서 `< > & " '` 를 지우고 앞뒤 공백을 자른 뒤 앞 10글자. 결과가 빈 문자열이면 `'플레이어'`.
5. `sanitizeAvatar(a)`: 객체가 아니면 빈 객체로 본다. 색 필드(`skin`, `hair`, `shirt`, `pants`)는 `/^#[0-9a-fA-F]{6}$/` 에 맞으면 그대로, 아니면 `AVATAR_DEFAULT` 의 값. `hairStyle` 은 `Number(v) | 0` 을 0~3 으로, `face` 는 0~2 로 자른다.

## 경계 조건
- 이름이 공백만이거나 금지 문자만이면 `'플레이어'`.
- 11글자 이름은 10글자로 잘린다. 금지 문자를 지운 뒤에 자른다.
- `join` 의 `code` 는 소문자·앞뒤 공백을 허용한다 (`' abcd '` → `'ABCD'`).
- `hairStyle: 9` → 3, `hairStyle: -2` → 0, `hairStyle: '2'` → 2.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | `'{bad'`, `'3'`, `'{"x":1}'` | `parseClientMessage` | 모두 `null` |
| 2 | `'{"type":"fly"}'` | `parseClientMessage` | `ProtocolError('알 수 없는 요청')` |
| 3 | `{"type":"create","name":"<민수>","mode":"zzz","avatar":{"skin":"red"},"x":1}` | `parseClientMessage` | `{type:'create', name:'민수', mode:'full', avatar: 기본 피부 #f5d0b0 …}`, `x` 없음 |
| 4 | `{"type":"join","code":" abcd ","token":""}` | `parseClientMessage` | `code 'ABCD'`, `token` 속성 없음, `name '플레이어'` |
| 5 | `{"type":"chat","text":"가"×200}` | `parseClientMessage` | text 길이 120 |
| 6 | `{"type":"setMode","mode":"hard"}` | `parseClientMessage` | `ProtocolError('알 수 없는 모드입니다.')` |
| 7 | `{"type":"action","action":{"type":"card","index":1.7,"number":"7"}}` | `parseClientMessage` | `{type:'action', action:{type:'card', index:1}}` (number 는 수가 아니라 빠짐) |
| 8 | `{"type":"action","action":{"type":"spin","power":"x"}}` | `parseClientMessage` | `action.power === 0` |
| 9 | `{"type":"action","action":{"type":"jump"}}` | `parseClientMessage` | `ProtocolError('알 수 없는 조작입니다.')` |
| 10 | `'  가나다라마바사아자차카  '` | `sanitizeName` | `'가나다라마바사아자차'` |
| 11 | `{ hairStyle: 9, face: -1, shirt: '#ABCDEF' }` | `sanitizeAvatar` | hairStyle 3, face 0, shirt `#ABCDEF`, 나머지 기본값 |

## 참조
- [engine.md](../../engine/engine.md): `Action`, `PublicState`, `GameEvent`, `Mode` 타입
- [data.md](../../data/data.md): `Avatar` 타입, `AVATAR_DEFAULT`
