/**
 * @pyramid-spec      design/engine/engine.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/engine/engine.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import {
  RuleError, createContext, newGameState, salaryOf as coreSalaryOf,
  type Action, type ChoiceKind, type ChoiceResolver, type GameEvent, type GameState, type Mode, type Player, type PlayerSeed,
  type PublicState, type SpinPurpose, type SpinResolver,
} from './core/core';
import { advance, resolveCareer, resolveClub, resolveMoveSpin, resolveRoute, startGame } from './flow/flow';
import {
  resolveBet, resolveBetChoice, resolveEvent, resolveGamble, resolveHiyari, resolveHouse, resolveJackpot, resolveOmikuji, resolvePray, resolveTravel,
} from './tiles/tiles';
import { resolveCrush, resolveDestiny, resolveJob, resolvePropose, resolveProposeChoice, resolveRankup, useCard } from './systems/systems';
import { applyInput, type Resolvers } from './actions/actions';
import { chooseAction } from './cpu/cpu';

export type {
  GameState, PublicState, Player, Pending, Action, GameEvent, Mode, PlayerSeed, GameResult, MsgKind, PartnerState,
  SpinPending, ChoicePending, ChoiceOption, SpinPurpose, ChoiceKind,
} from './core/core';
export { RuleError };

const SPIN: Record<SpinPurpose, SpinResolver> = {
  move: resolveMoveSpin, rankup: resolveRankup, gamble: resolveGamble, hiyari: resolveHiyari, propose: resolvePropose,
  bet: resolveBet, jackpot: resolveJackpot, pray: resolvePray, omikuji: resolveOmikuji,
};
const CHOICE: Record<ChoiceKind, ChoiceResolver> = {
  club: resolveClub, career: resolveCareer, job: resolveJob, crush: resolveCrush, route: resolveRoute, event: resolveEvent,
  propose: resolveProposeChoice, destiny: resolveDestiny, travel: resolveTravel, bet: resolveBetChoice, house: resolveHouse,
};
const RESOLVERS: Resolvers = { spin: SPIN, choice: CHOICE, useCard };

export function createGame(opts: { players: PlayerSeed[]; mode?: Mode; seed: number }): { state: GameState; events: GameEvent[] } {
  const state = newGameState(opts);
  const ctx = createContext(state);
  startGame(ctx);
  return { state, events: ctx.events };
}

export function applyAction(state: GameState, playerId: string, action: Action): { state: GameState; events: GameEvent[] } {
  if (state.phase !== 'playing') throw new RuleError('게임이 진행 중이 아닙니다.');
  const next = structuredClone(state);
  const ctx = createContext(next);
  applyInput(ctx, playerId, action, RESOLVERS);
  advance(ctx);
  next.seq += 1;
  return { state: next, events: ctx.events };
}

export function cpuAction(state: GameState, rand?: () => number): Action | null {
  return chooseAction(state, rand);
}

export function publicState(state: GameState): PublicState {
  const { rng: _rng, ...rest } = state;
  return rest;
}

export function salaryOf(player: Player): number {
  return coreSalaryOf(player);
}
