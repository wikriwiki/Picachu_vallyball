---
pyramid: leaf
id: types
title: 타입
parent: ../core.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [엔진 코어](../core.md) 의 「자식 구성요소」 중 `타입` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 타입

## 정의
룰 엔진이 다루는 모든 데이터의 모양이다. 게임 상태, 플레이어, 연애 후보 상태, 대기(룰렛·선택), 조작, 연출 이벤트, 결과 발표, 판정 컨텍스트와 판정 함수의 타입을 정의하고, 잘못된 조작을 알리는 `RuleError` 를 둔다.

## 인터페이스
- 구현 위치: `src/engine/core/types/types.ts`, 테스트 `src/engine/core/types/types.test.ts`
- 형태: 타입 + `RuleError` 클래스
- 공개 API:
  ```ts
  import type { Avatar, StatKey, CardId, RouteId, Effect, SubmapId } from '../../../data/data';

  export type Mode = 'full' | 'adult' | 'kids';
  export interface PlayerSeed { id: string; name: string; avatar: Avatar; cpu: boolean; }
  export interface PartnerRef { id: string; affinity: number; }
  export interface Treasure { name: string; base: number; }
  export interface House { id: string; name: string; price: number; }
  export interface Player {
    id: string; name: string; avatar: Avatar; cpu: boolean;
    tile: number; money: number; notes: number;
    stats: Record<StatKey, number>; fortune: number;
    job: string | null; rank: number;
    partner: PartnerRef | null; spouse: string | null;
    subReturn: number | null;               // 서브맵 여행 중이면 돌아올 본 맵 칸
    kids: string[]; cards: CardId[]; treasures: Treasure[]; houses: House[];
    club: string | null; college: boolean;
    cardUsed: boolean; doneEra: boolean; finished: boolean; finishOrder: number | null;
  }
  export interface PartnerState { id: string; name: string; job: string; personality: StatKey; color: string; stars: number; takenBy: string | null; }

  export type SpinPurpose = 'move' | 'rankup' | 'gamble' | 'hiyari' | 'propose' | 'bet' | 'jackpot' | 'pray' | 'omikuji';
  export type ChoiceKind = 'club' | 'career' | 'job' | 'crush' | 'route' | 'event' | 'propose' | 'destiny' | 'travel' | 'bet' | 'house';
  export interface SpinPending {
    type: 'spin'; playerId: string; purpose: SpinPurpose; title: string;
    need?: number; amount?: number; stat?: StatKey; fixed?: number; double?: boolean;
  }
  export interface ChoiceOption {
    label: string; desc?: string; disabled?: boolean;
    jobId?: string; partnerId?: string; houseId?: string; next?: number; route?: RouteId; amount?: number; effect?: Effect;
  }
  export interface ChoicePending {
    type: 'choice'; kind: ChoiceKind; playerId: string; title: string; options: ChoiceOption[];
    remaining?: number; candidate?: string; sub?: SubmapId;
  }
  export type Pending = SpinPending | ChoicePending;
  export interface QueuedChoice { kind: 'club' | 'crush' | 'career' | 'job'; playerId: string; }

  export type Action =
    | { type: 'spin'; power: number }
    | { type: 'choose'; index: number }
    | { type: 'card'; index: number; number?: number };

  export type MsgKind = 'info' | 'event' | 'lucky' | 'bad' | 'love' | 'card' | 'payday';
  export type GameEvent =
    | { t: 'turn'; pid: string; era: number; round: number }
    | { t: 'spin'; pid: string; value: number; purpose: SpinPurpose | 'freelance'; fixed?: boolean; auto?: boolean }
    | { t: 'move'; pid: string; path: number[] }
    | { t: 'land'; pid: string; tile: number; type: string }
    | { t: 'msg'; pid: string | null; text: string; kind: MsgKind }
    | { t: 'money'; pid: string; delta: number; reason: string }
    | { t: 'note'; pid: string; count: number; total: number }
    | { t: 'stat'; pid: string; stat: StatKey; delta: number; value: number }
    | { t: 'fortune'; pid: string; delta: number; value: number }
    | { t: 'partner'; pid: string; partner: string; name: string; stars: number; affinity: number }
    | { t: 'affinity'; pid: string; delta: number; value: number }
    | { t: 'junction'; pid: string; tile: number; options: number[] }
    | { t: 'card'; pid: string; card: CardId; gained?: boolean; used?: boolean }
    | { t: 'treasure'; pid: string; name: string }
    | { t: 'house'; pid: string; house: string }
    | { t: 'job'; pid: string; job: string; rank: number; promoted: boolean }
    | { t: 'marry'; pid: string; spouse: string; partner: string }
    | { t: 'kid'; pid: string; name: string; count: number }
    | { t: 'era'; era: number; name: string }
    | { t: 'warp'; pid: string; tile: number; fly?: boolean }
    | { t: 'goal'; pid: string; order: number }
    | { t: 'chose'; pid: string; kind: ChoiceKind; index: number; label: string }
    | { t: 'result'; result: GameResult };

  export interface ResultItem { label: string; amount: number; }
  export interface ResultRow { pid: string; items: ResultItem[]; total: number; }
  export interface GameResult { rows: ResultRow[]; ranking: string[]; }

  export interface GameState {
    v: 1; rng: number; mode: Mode; phase: 'playing' | 'ended';
    era: number; round: number; turn: number; turnActive: boolean;
    players: Player[]; partners: PartnerState[];
    pending: Pending | null; queue: QueuedChoice[]; log: string[];
    finishCount: number; result: GameResult | null; seq: number;
  }
  export type PublicState = Omit<GameState, 'rng'>;

  export interface Ctx {
    readonly state: GameState;
    readonly events: GameEvent[];
    rnd(): number; rint(n: number): number; choose<T>(arr: readonly T[]): T;
    player(id: string): Player;
    msg(p: Player | null, text: string, kind?: MsgKind): void;
    log(text: string): void;
  }
  export type SpinResolver = (ctx: Ctx, p: Player, pending: SpinPending, value: number) => void;
  export type ChoiceResolver = (ctx: Ctx, p: Player, pending: ChoicePending, index: number) => void;

  export class RuleError extends Error { readonly name = 'RuleError'; }
  ```

## 동작 규칙
1. 런타임 값은 `RuleError` 하나뿐이다. `new RuleError('x')` 는 `Error` 이고 `message === 'x'`, `name === 'RuleError'`.
2. 모든 상태 타입은 JSON 으로 표현 가능한 값만 담는다.

## 경계 조건
- `instanceof RuleError` 로 구분할 수 있어야 한다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `new RuleError('x')` | `instanceof Error`, `instanceof RuleError`, message 'x', name 'RuleError' |
| 2 | — | `try { throw new RuleError('y') } catch (e)` | `e instanceof RuleError` |
| 3 | 타입 검사 | `tsc --noEmit` | 이 파일이 오류 없이 컴파일 |

## 참조
- [data.md](../../../data/data.md): `Avatar`, `StatKey`, `CardId`, `RouteId`, `Effect`, `SubmapId`
