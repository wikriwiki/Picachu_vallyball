/**
 * @pyramid-spec      design/engine/core/context/context.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/context/context.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { LOG_MAX, rngNext } from '../../../data/data';
import { RuleError, type Ctx, type GameEvent, type GameState, type MsgKind, type Player } from '../types/types';

export function createContext(state: GameState): Ctx {
  const events: GameEvent[] = [];
  const rnd = () => {
    const r = rngNext(state.rng);
    state.rng = r.seed;
    return r.value;
  };
  const rint = (n: number) => Math.floor(rnd() * n);
  const log = (text: string) => {
    state.log.push(text);
    if (state.log.length > LOG_MAX) state.log.shift();
  };
  return {
    state,
    events,
    rnd,
    rint,
    choose: <T>(arr: readonly T[]): T => arr[rint(arr.length)],
    player(id: string): Player {
      const p = state.players.find((x) => x.id === id);
      if (!p) throw new RuleError('플레이어가 없습니다.');
      return p;
    },
    msg(p: Player | null, text: string, kind: MsgKind = 'info') {
      events.push({ t: 'msg', pid: p ? p.id : null, text, kind });
      log(p ? `${p.name}: ${text}` : text);
    },
    log,
  };
}
