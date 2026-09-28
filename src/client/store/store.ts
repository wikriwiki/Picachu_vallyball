/**
 * @pyramid-spec      design/client/store/store.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/store/store.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { LobbyInfo } from '../../server/protocol/protocol';
import type { PublicState, Pending, Player } from '../../engine/engine';

export interface StoreData {
  me: string | null;
  room: LobbyInfo | null;
  state: PublicState | null;
  shown: PublicState | null;
  busy: boolean;
  queued: number;
  sentSeq: number;
  resultShown: boolean;
}
export type StoreKey = keyof StoreData;
export interface Store {
  get<K extends StoreKey>(key: K): StoreData[K];
  set(patch: Partial<StoreData>): void;
  subscribe(fn: (changed: StoreKey[]) => void): () => void;
  myPending(): Pending | null;
  myPlayer(): Player | null;
  focusPlayer(s: PublicState): Player;
}

export function createStore(): Store {
  const d: StoreData = { me: null, room: null, state: null, shown: null, busy: false, queued: 0, sentSeq: -1, resultShown: false };
  const subs = new Set<(changed: StoreKey[]) => void>();
  return {
    get: (k) => d[k],
    set(patch) {
      const changed: StoreKey[] = [];
      for (const k of Object.keys(patch) as StoreKey[]) {
        if (d[k] !== patch[k]) { (d as unknown as Record<string, unknown>)[k] = patch[k]; changed.push(k); }
      }
      if (changed.length) for (const fn of [...subs]) fn(changed);
    },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    myPending() {
      const s = d.state;
      if (!s || s.phase !== 'playing' || d.busy || d.queued !== 0) return null;
      if (!s.pending || s.pending.playerId !== d.me) return null;
      if (d.sentSeq === s.seq) return null;
      return s.pending;
    },
    myPlayer() { return d.state?.players.find((p) => p.id === d.me) ?? null; },
    focusPlayer(s) {
      const id = s.pending?.playerId ?? d.me;
      return s.players.find((p) => p.id === id) ?? s.players.find((p) => p.id === d.me) ?? s.players[0];
    },
  };
}
