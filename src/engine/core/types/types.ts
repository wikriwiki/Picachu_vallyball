/**
 * @pyramid-spec      design/engine/core/types/types.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/types/types.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
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
  subReturn: number | null;
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
  rnd(): number;
  rint(n: number): number;
  choose<T>(arr: readonly T[]): T;
  player(id: string): Player;
  msg(p: Player | null, text: string, kind?: MsgKind): void;
  log(text: string): void;
}
export type SpinResolver = (ctx: Ctx, p: Player, pending: SpinPending, value: number) => void;
export type ChoiceResolver = (ctx: Ctx, p: Player, pending: ChoicePending, index: number) => void;

export class RuleError extends Error {
  override readonly name = 'RuleError';
}
