/**
 * @pyramid-spec      design/engine/core/setup/setup.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/setup/setup.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { ADULT_ERA, ADULT_START_MONEY, BOARD, FORTUNE_START, PARTNERS, STAR_WEIGHTS, STAT_START, rngNext } from '../../../data/data';
import { RuleError, type GameState, type Mode, type Player, type PlayerSeed } from '../types/types';

export function newGameState(opts: { players: PlayerSeed[]; mode?: Mode; seed: number }): GameState {
  const { players } = opts;
  if (!players || players.length < 1 || players.length > 4) throw new RuleError('플레이어는 1~4명이어야 합니다.');
  const mode: Mode = opts.mode ?? 'full';
  const startEra = mode === 'adult' ? ADULT_ERA : 0;
  const s: GameState = {
    v: 1, rng: opts.seed >>> 0, mode, phase: 'playing', era: startEra, round: 0, turn: 0, turnActive: false,
    players: players.map((p): Player => ({
      id: p.id, name: p.name, avatar: { ...p.avatar }, cpu: !!p.cpu,
      tile: BOARD.eraStart[startEra], money: 0, notes: 0,
      stats: { int: STAT_START, phy: STAT_START, sen: STAT_START }, fortune: FORTUNE_START,
      job: null, rank: 0, partner: null, spouse: null, subReturn: null,
      kids: [], cards: [], treasures: [], houses: [], club: null, college: false,
      cardUsed: false, doneEra: false, finished: false, finishOrder: null,
    })),
    partners: [], pending: null, queue: [], log: [], finishCount: 0, result: null, seq: 0,
  };
  const rnd = () => { const r = rngNext(s.rng); s.rng = r.seed; return r.value; };
  const rint = (n: number) => Math.floor(rnd() * n);
  const total = STAR_WEIGHTS.reduce((a, b) => a + b, 0);
  s.partners = PARTNERS.map((c) => {
    let r = rnd() * total;
    let stars = 1;
    for (let k = 0; k < STAR_WEIGHTS.length; k++) { r -= STAR_WEIGHTS[k]; if (r < 0) { stars = k + 1; break; } }
    return { id: c.id, name: c.name, job: c.job, personality: c.personality, color: c.color, stars, takenBy: null };
  });
  if (mode === 'adult') {
    for (const p of s.players) {
      p.stats = { int: 15 + rint(45), phy: 15 + rint(45), sen: 15 + rint(45) };
      p.money = ADULT_START_MONEY;
    }
  }
  return s;
}
