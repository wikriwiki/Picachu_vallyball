---
pyramid: leaf
id: playback
title: 재생
parent: ../client.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `재생` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 재생

## 정의
서버가 보낸 `(상태, 이벤트 목록)` 묶음을 큐에 쌓고, 한 묶음씩 이벤트를 차례로 연출한다. 연출하는 동안에는 저장소의 `shown`(표시 상태)을 이벤트에 맞춰 조금씩 바꿔 HUD 가 따라가게 하고, 묶음이 끝나면 그 묶음의 최종 상태를 `state` 로 반영한다. 밀린 묶음이 많으면 대기 시간을 줄여 따라잡는다.

## 인터페이스
- 구현 위치: `src/client/playback/playback.ts`, 테스트 `src/client/playback/playback.test.ts`
- 형태: 팩토리 함수
- 공개 API:
  ```ts
  import type { PublicState, GameEvent } from '../../engine/engine';
  import type { ClientCtx } from '../ctx';

  export interface Playback {
    enqueue(state: PublicState, events: GameEvent[]): void;
    reset(): void;                                  // 대기 큐 비우기 (진행 중인 묶음은 끝까지)
  }
  export function createPlayback(ctx: ClientCtx, deps?: { sleep?: (ms: number) => Promise<void> }): Playback;
  ```
- 사용하는 것: `ctx.store`, `ctx.shell.show`, `ctx.ensureView()`, `ctx.display`(`renderHud`, `message`, `floater`, `banner`, `addLog`, `sound`, `showResult`), `ctx.controls.updateControls()`, 데이터의 `formatMoney`, `STAT_NAMES`, `FORTUNES`, `CARDS`, `jobById`.
- 상태: 묶음 큐 `{ state, events }[]`.

## 동작 규칙
1. `enqueue(state, events)`: 큐 뒤에 넣고 `store.queued` 를 큐 길이로 맞춘 뒤 `pump()` 를 부른다 (기다리지 않음).
2. `pump()`: `store.busy` 가 true 면 바로 끝낸다. 아니면 `busy = true` 로 두고 `view = await ctx.ensureView()` 후, 큐가 빌 때까지 한 묶음씩 꺼내 (`queued` 갱신) 처리한다. 처리 중 예외는 `console.error` 로 남기고 다음 묶음으로 넘어간다. 모두 끝나면 `busy = false`, `ctx.controls.updateControls()`.
3. 한 묶음 처리:
   - `store.state` 가 `null` 이면(첫 상태, 재접속 포함): `shell.show('game')`, `shown = structuredClone(state)`, `view.syncPieces(state, false)`, `view.focus(state.pending?.playerId ?? state.players[0].id, true)`, `renderHud(state)`, `store.state = state`, 이벤트가 있으면 연출한다.
   - 아니면: `shown = structuredClone(store.state)`, `view.syncPieces(shown, true)`, 이벤트를 연출한 뒤 `store.state = state`.
   - 공통 마무리: `view.syncPieces(state, false)`, `renderHud(state)`. `state.phase === 'ended'` 이고 `resultShown` 이 false 면 `resultShown = true` 후 `await showResult(state)`.
4. 빠르게 모드: 이벤트를 연출하는 시점에 큐에 남은 묶음이 3개보다 많으면 `wait(ms)` 는 `ms × 0.3` 만 기다리고, 룰렛은 빠르게 돌린다.
5. 이벤트별 연출 (`P` = `shown` 에서 `pid` 의 플레이어, `idx` = 그 플레이어의 순번, `me` = `store.me`):

| 이벤트 | 연출 | 대기 |
|---|---|---|
| `turn` | `focus(pid)`, `zoomDefault()`, `shown.pending = { type:'spin', playerId: pid, purpose:'move', title:'' }`, `renderHud(shown)`, 메시지 (내 차례면 "당신의 차례! 룰렛을 돌리세요." 아니면 "{이름}의 차례", `info`), 소리 `turn` | 0 |
| `spin` | `focus(pid)`. 목적이 `freelance` 면 메시지 "프리랜서 수입 룰렛!"(`payday`). `await roulette.spinTo(value, 빠르게 \|\| auto)`, 떠오르는 글자 `🎯 {value}`(`info`) | 350 |
| `move` | `focus(pid)`, `await hopPath(pid, path, idx, onStep)`. 각 칸마다 소리 `hop`, `setActiveTile(칸)`, `P.tile = 칸` | 0 |
| `land` | `setActiveTile(tile)` | 0 |
| `msg` | 메시지(text, kind, pid). kind 별 소리: `lucky`→lucky, `bad`→lose, `love`→love, `card`→card. 기록에 "**{이름}**: {text}"(pid 없으면 text) 추가 | 1150 |
| `money` | `P.money += delta`, 떠오르는 글자 `+{formatMoney(delta)}`(양수, `plus`) 또는 `{formatMoney(delta)}`(음수, `minus`). 양수면 소리 `money`. `renderHud(shown)` | 250 |
| `note` | `P.notes = total`, `P.money += count × 1000`, 떠오르는 글자 `📄 약속어음 +{count}장`(`minus`), `renderHud` | 500 |
| `stat` | `P.stats[stat] = value`, 글자 `{STAT_NAMES[stat]} {+/-}{delta}`(양수 `plus`/음수 `minus`), `renderHud` | 220 |
| `fortune` | `P.fortune = value`, 글자 `운세 {FORTUNES[value]}`, `renderHud` | 220 |
| `partner` | `P.partner = { id: partner, affinity }`, 글자 `💘 {name} {★×stars}`(`plus`), `renderHud` | 500 |
| `affinity` | `P.partner.affinity = value`(상대가 있을 때), 글자 `💗 호감도 {+/-}{delta}`, `renderHud` | 300 |
| `junction` | `focus(pid)`, 메시지 (내 차례면 "갈림길이다! 어느 길로 갈지 고르세요." 아니면 "갈림길에서 고민 중...", `info`) | 300 |
| `card` | 얻음: `P.cards.push(card)`, 글자 `🃏 {카드 이름}`(`info`), 소리 `card`. 사용: `P.cards` 에서 처음 나오는 같은 카드 하나 제거, 메시지 "{카드 이름} 사용!"(`lucky`), 소리 `card`, 700 대기. 끝에 `renderHud` | 0 / 700 |
| `treasure` | 글자 `💎 {name}`(`info`) | 400 |
| `house` | `confettiAt(pid)` | 0 |
| `job` | `P.job = job`, `P.rank = rank`. 승진이면 글자 `⬆️ {랭크 이름}`(`plus`), 기록 "**{이름}**: {아이콘} {랭크 이름} 승진!", `confettiAt`, 소리 `lucky`. `renderHud` | 500 |
| `marry` | `P.spouse = spouse`, `confettiAt`, `flash(0.35)`, 소리 `love`, `syncPieces(shown, true)` | 600 |
| `kid` | `P.kids.push(name)`, `confettiAt`, 소리 `love`, `syncPieces(shown, true)` | 500 |
| `era` | `shown.era = era`, `flash(0.7)`, 소리 `era`, `renderHud(shown)`, `await banner("{name}<small>새로운 시대가 시작됩니다!</small>", 빠르게 ? 900 : 2200)` (이름은 HTML 이스케이프) | 0 |
| `warp` | `P.tile = tile`, `focus(pid)`, `syncPieces(shown, true)`, fly 면 소리 `lucky`, `await warp(pid, tile, idx, fly)` | 0 |
| `goal` | `P.finished = true`, `focus(pid)`, `confettiAt`, `flash(0.5)`, 소리 `fanfare` | 900 |
| `chose` | 내가 아니면 메시지 "「{label}」 을(를) 골랐다."(`info`) | 내가 아니면 900, 나면 100 |
| `result` | — | 600 |

6. `reset()` 은 대기 큐를 비우고 `queued = 0` 으로 둔다.

## 경계 조건
- 알 수 없는 이벤트 종류는 건너뛴다.
- `shown` 에 없는 `pid` 의 이벤트(있을 수 없지만)는 건너뛴다.
- 연출 도중 `enqueue` 가 불리면 큐에만 쌓이고, 현재 묶음이 끝난 뒤 이어서 처리된다 (동시에 두 묶음을 처리하지 않는다).
- 첫 상태에 이벤트가 없으면 연출 없이 바로 반영된다.

## 테스트 케이스
가짜 `ctx`(view·display·controls 의 호출을 기록, `sleep` 은 즉시 resolve 하며 인자를 기록)로 검사한다.

| # | Given | When | Then |
|---|---|---|---|
| 1 | 저장소 state null | `enqueue(s1, [])` 후 대기 | `show('game')`, `syncPieces(s1,false)` 가 불리고 `store.state === s1`, `busy` false, `updateControls` 1회 |
| 2 | state s1 반영됨 | `enqueue(s2, [money +100 for p1])` | `renderHud` 에 넘긴 shown 의 p1.money 가 s1 값 +100, 떠오르는 글자 `+100만원`, 끝나면 `store.state === s2` |
| 3 | state s1 | `enqueue(s2, [msg lucky])` | 메시지·소리 lucky·기록 1줄, sleep(1150) 1회 |
| 4 | state s1 | 한 번에 5묶음 enqueue | 묶음 순서대로 처리, 첫 묶음 연출 중 sleep 인자가 원래 값의 0.3배 |
| 5 | state s1 | `enqueue(s2, [card used 'double'])` (p1 손패 ['double','fixed']) | shown p1.cards 가 ['fixed'], 메시지 "더블 카드 사용!" |
| 6 | state s1 | `enqueue(s2 ended, [result])` | `showResult(s2)` 1회, 다시 ended 상태 enqueue 해도 추가 호출 없음 |
| 7 | state s1 | `enqueue(s2, [move path [5,6,7]])` | `hopPath` 호출, onStep 3회로 shown 의 tile 이 7 |
| 8 | view 의 `hopPath` 가 예외 | `enqueue(s2, [move])` 후 `enqueue(s3, [])` | `console.error` 1회, s3 는 정상 반영, `busy` false |
| 9 | 큐 2묶음 대기 중 | `reset()` | 진행 중이던 묶음만 끝나고 남은 묶음은 처리되지 않음, `queued` 0 |
| 10 | me 가 p2, 이벤트 `chose` pid p1 | 재생 | 메시지 "「대학 진학」 을(를) 골랐다.", sleep(900) |

## 참조
- [engine.md](../../engine/engine.md): `PublicState`, `GameEvent`
- [data.md](../../data/data.md): `formatMoney`, `STAT_NAMES`, `FORTUNES`, `CARDS`, `jobById`
- [view.md](../../view/view.md): `View`
- [store.md](../store/store.md), [display.md](../display/display.md), [controls.md](../controls/controls.md), [shell.md](../shell/shell.md): 형제의 공개 API
