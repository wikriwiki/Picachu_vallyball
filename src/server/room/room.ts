/**
 * @pyramid-spec      design/server/room/room.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/room/room.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import crypto from 'node:crypto';
import { applyAction, cpuAction, createGame, publicState, type Action, type GameEvent, type GameState, type Mode } from '../../engine/engine';
import { AVATAR_DEFAULT, type Avatar } from '../../data/data';
import { MAX_PLAYERS, type LobbyInfo, type ServerMessage } from '../protocol/protocol';
import { delayFor, type DelayOptions } from '../scheduler/scheduler';

export interface Member { id: string; token: string | null; name: string; avatar: Avatar; cpu: boolean; connected: boolean; }
export interface Transport { send(memberId: string, msg: ServerMessage): void; broadcast(msg: ServerMessage): void; }
export interface RoomDeps {
  randomHex(bytes: number): string;
  randomSeed(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
export const CPU_NAMES: readonly string[] = ['CPU 하나', 'CPU 두리', 'CPU 세찌', 'CPU 네찌'];
export const CPU_SHIRTS: readonly string[] = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419'];
export const CPU_HAIRS: readonly string[] = ['#2b2b2b', '#8a5a2b', '#e0b050', '#c0392b'];

const defaultDeps: RoomDeps = {
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  randomSeed: () => crypto.randomBytes(4).readUInt32LE(0),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class Room {
  members: Member[] = [];
  hostId: string | null = null;
  mode: Mode = 'full';
  game: GameState | null = null;
  emptySince: number | null = null;
  private timer: unknown = null;
  private readonly deps: RoomDeps;

  constructor(readonly code: string, private readonly transport: Transport, private readonly opts: DelayOptions, deps: Partial<RoomDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  humans(): Member[] { return this.members.filter((m) => !m.cpu); }

  lobbyInfo(): LobbyInfo {
    return {
      code: this.code, hostId: this.hostId, mode: this.mode, started: this.game !== null,
      members: this.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, cpu: m.cpu, connected: m.cpu || m.connected })),
    };
  }

  sendLobby(): void { this.transport.broadcast({ type: 'lobby', room: this.lobbyInfo() }); }

  addHuman(name: string, avatar: Avatar): Member {
    if (this.game) throw new Error('이미 게임이 시작된 방입니다.');
    if (this.members.length >= MAX_PLAYERS) throw new Error('방이 가득 찼습니다. (최대 4명)');
    const m: Member = { id: 'u' + this.deps.randomHex(4), token: this.deps.randomHex(12), name, avatar, cpu: false, connected: true };
    this.members.push(m);
    if (!this.hostId) this.hostId = m.id;
    return m;
  }

  addCpu(): Member {
    if (this.game) throw new Error('게임 중에는 추가할 수 없습니다.');
    if (this.members.length >= MAX_PLAYERS) throw new Error('방이 가득 찼습니다.');
    const h = this.members.filter((m) => m.cpu).length % 4;
    const m: Member = {
      id: 'c' + this.deps.randomHex(4), token: null, name: CPU_NAMES[h], cpu: true, connected: true,
      avatar: { ...AVATAR_DEFAULT, shirt: CPU_SHIRTS[h], hairStyle: h, hair: CPU_HAIRS[h] },
    };
    this.members.push(m);
    return m;
  }

  removeMember(id: string): Member | null {
    if (this.game) throw new Error('게임 중에는 할 수 없습니다.');
    const m = this.members.find((x) => x.id === id);
    if (!m) return null;
    this.members = this.members.filter((x) => x !== m);
    return m;
  }

  setMode(mode: Mode): void { if (!this.game) this.mode = mode; }

  start(): void {
    if (this.game) throw new Error('이미 시작했습니다.');
    if (!this.members.length) throw new Error('플레이어가 없습니다.');
    const r = createGame({
      players: this.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, cpu: m.cpu })),
      mode: this.mode, seed: this.deps.randomSeed(),
    });
    this.game = r.state;
    this.sendLobby();
    this.pushState(r.events);
  }

  private pushState(events: GameEvent[]): void {
    const g = this.game!;
    this.transport.broadcast({ type: 'state', state: publicState(g), events, seq: g.seq });
    this.schedule(events);
  }

  act(playerId: string, action: Action): void {
    if (!this.game) throw new Error('게임이 시작되지 않았습니다.');
    const r = applyAction(this.game, playerId, action);
    this.game = r.state;
    this.pushState(r.events);
  }

  schedule(events: readonly GameEvent[]): void {
    if (this.timer != null) { this.deps.clearTimeout(this.timer); this.timer = null; }
    const g = this.game;
    if (!g || g.phase !== 'playing' || !g.pending) return;
    const who = g.pending.playerId;
    const m = this.members.find((x) => x.id === who);
    const kind = !m || m.cpu ? 'cpu' : m.connected ? 'human' : 'offline';
    const seq = g.seq;
    this.timer = this.deps.setTimeout(() => {
      this.timer = null;
      const cur = this.game;
      if (!cur || cur.seq !== seq || !cur.pending) return;
      const a = cpuAction(cur);
      if (!a) return;
      try { this.act(cur.pending.playerId, a); } catch { /* 방이 멈추지 않게 삼킨다 */ }
    }, delayFor(kind, events, this.opts));
  }

  rematch(): void {
    if (!this.game || this.game.phase !== 'ended') return;
    this.dispose();
    this.game = null;
    this.members = this.members.filter((m) => m.cpu || m.connected);
    this.sendLobby();
    this.transport.broadcast({ type: 'backToLobby' });
  }

  dispose(): void {
    if (this.timer != null) { this.deps.clearTimeout(this.timer); this.timer = null; }
  }
}
