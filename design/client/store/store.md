---
pyramid: leaf
id: store
title: 상태 저장소
parent: ../client.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `상태 저장소` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 상태 저장소

## 정의
클라이언트의 공유 상태를 한곳에 보관하는 저장소다. 다른 자식은 이 저장소로만 공유 상태를 읽고 쓰며, 값이 바뀌면 구독자에게 어떤 키가 바뀌었는지 알린다. 조작 가능 여부(`myPending`)와 HUD 가 초점을 둘 플레이어(`focusPlayer`) 같은 파생 값도 여기서 계산한다.

## 인터페이스
- 구현 위치: `src/client/store/store.ts`, 테스트 `src/client/store/store.test.ts`
- 형태: 팩토리 함수 + 인터페이스
- 공개 API:
  ```ts
  import type { LobbyInfo } from '../../server/protocol/protocol';
  import type { PublicState, Pending, Player } from '../../engine/engine';

  export interface StoreData {
    me: string | null;              // 내 플레이어 ID
    room: LobbyInfo | null;         // 마지막 로비 정보
    state: PublicState | null;      // 재생이 끝나 화면에 반영된 마지막 상태
    shown: PublicState | null;      // 재생 중 HUD 가 보여 주는 상태 (이벤트에 따라 조금씩 바뀜)
    busy: boolean;                  // 재생 중이면 true
    queued: number;                 // 재생 대기 중인 상태 묶음 수
    sentSeq: number;                // 마지막으로 조작을 보낸 상태의 seq, 없으면 -1
    resultShown: boolean;           // 이번 게임의 결과 발표를 이미 보여 줬는지
  }
  export type StoreKey = keyof StoreData;
  export interface Store {
    get<K extends StoreKey>(key: K): StoreData[K];
    set(patch: Partial<StoreData>): void;
    subscribe(fn: (changed: StoreKey[]) => void): () => void; // 해제 함수 반환
    myPending(): Pending | null;
    myPlayer(): Player | null;       // state 에서 내 플레이어
    focusPlayer(s: PublicState): Player;
  }
  export function createStore(): Store;
  ```

## 동작 규칙
1. 초기값: `me = null`, `room = null`, `state = null`, `shown = null`, `busy = false`, `queued = 0`, `sentSeq = -1`, `resultShown = false`.
2. `set(patch)`: patch 의 각 키 중 현재 값과 `===` 로 다른 것만 바꾸고, 바뀐 키가 하나 이상이면 모든 구독자를 바뀐 키 목록(patch 에 적힌 순서)으로 한 번씩 부른다.
3. `subscribe(fn)` 은 해제 함수를 돌려준다. 해제 후에는 불리지 않는다.
4. `myPending()` 은 다음을 모두 만족할 때만 `state.pending` 을, 아니면 `null` 을 돌려준다: `state` 가 있다, `state.phase === 'playing'`, `busy === false`, `queued === 0`, `state.pending` 이 있고 `playerId === me`, `sentSeq !== state.seq`.
5. `myPlayer()` 는 `state.players` 에서 `id === me` 인 플레이어, 없으면 `null`.
6. `focusPlayer(s)`: 먼저 `s.pending?.playerId`, 없으면 `me` 를 ID 로 삼아 `s.players` 에서 찾는다. 없으면 `me` 의 플레이어, 그것도 없으면 `s.players[0]`.

## 경계 조건
- `set({})` 이나 같은 값만 담은 patch 는 구독자를 부르지 않는다.
- 구독자 안에서 `set` 을 다시 불러도 된다 (그 호출은 따로 알림을 보낸다).
- `state` 가 `ended` 이면 `myPending()` 은 항상 `null` 이다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 새 저장소 | 각 키 `get` | 규칙 1 의 초기값 |
| 2 | 구독자 1개 | `set({ me: 'a', busy: false })` | 구독자가 `['me']` 로 한 번 불림 |
| 3 | 구독자 1개 | `set({})` | 불리지 않음 |
| 4 | 구독 후 해제 | `set({ me: 'b' })` | 불리지 않음 |
| 5 | me `a`, state(playing, pending a, seq 3), sentSeq -1, busy false, queued 0 | `myPending()` | state.pending |
| 6 | 5 와 같고 sentSeq 3 | `myPending()` | null |
| 7 | 5 와 같고 busy true / queued 1 / pending b / phase ended | `myPending()` | 각각 null |
| 8 | state.pending 없음, me `b`, players [a,b] | `focusPlayer(state)` | b |
| 9 | pending 없음, me null | `focusPlayer(state)` | players[0] |
| 10 | pending `z`(없는 ID), me `b` | `focusPlayer(state)` | b |

## 참조
- [protocol.md](../../server/protocol/protocol.md): `LobbyInfo`
- [engine.md](../../engine/engine.md): `PublicState`, `Pending`, `Player`
