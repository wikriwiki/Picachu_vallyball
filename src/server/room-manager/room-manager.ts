/**
 * @pyramid-spec      design/server/room-manager/room-manager.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/room-manager/room-manager.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import crypto from 'node:crypto';
import { publicState } from '../../engine/engine';
import type { ClientMessage, ServerMessage } from '../protocol/protocol';
import { Room, type Member, type RoomDeps } from '../room/room';
import type { DelayOptions } from '../scheduler/scheduler';

export interface Socket { send(text: string): void; close(): void; readonly isOpen: boolean; }
export interface ManagerDeps extends RoomDeps {
  randomInt(max: number): number;
  now(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMPTY_ROOM_TTL = 10 * 60 * 1000;

interface Binding { room: Room; member: Member; }

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly sockets = new Map<Socket, Binding>();
  private readonly memberSocket = new Map<string, Socket>();
  private readonly deps: Partial<ManagerDeps>;
  private readonly gc: unknown;

  constructor(private readonly opts: DelayOptions, deps: Partial<ManagerDeps> = {}) {
    this.deps = deps;
    const si = deps.setInterval ?? ((fn: () => void, ms: number) => { const h = setInterval(fn, ms); h.unref?.(); return h; });
    this.gc = si(() => this.collect(), 60000);
  }

  private now(): number { return (this.deps.now ?? Date.now)(); }
  private randomInt(max: number): number { return (this.deps.randomInt ?? crypto.randomInt)(max); }

  private sendTo(socket: Socket | undefined, msg: ServerMessage): void {
    if (socket && socket.isOpen) socket.send(JSON.stringify(msg));
  }

  private newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[this.randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  private makeRoom(): Room {
    const code = this.newCode();
    const transport = {
      send: (memberId: string, msg: ServerMessage) => this.sendTo(this.memberSocket.get(memberId), msg),
      broadcast: (msg: ServerMessage) => { for (const m of room.members) this.sendTo(this.memberSocket.get(m.id), msg); },
    };
    const room: Room = new Room(code, transport, this.opts, this.deps);
    this.rooms.set(code, room);
    return room;
  }

  private bind(socket: Socket, room: Room, member: Member): void {
    this.sockets.set(socket, { room, member });
    this.memberSocket.set(member.id, socket);
    this.sendTo(socket, { type: 'joined', code: room.code, playerId: member.id, token: member.token ?? '' });
    room.sendLobby();
    if (room.game) this.sendTo(socket, { type: 'state', state: publicState(room.game), events: [], seq: room.game.seq });
  }

  private unbind(socket: Socket): void {
    const b = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (b && this.memberSocket.get(b.member.id) === socket) this.memberSocket.delete(b.member.id);
  }

  handle(socket: Socket, msg: ClientMessage): void {
    const ctx = this.sockets.get(socket);
    switch (msg.type) {
      case 'create': {
        if (ctx) this.leave(socket);
        const room = this.makeRoom();
        room.setMode(msg.mode);
        const m = room.addHuman(msg.name, msg.avatar);
        this.bind(socket, room, m);
        return;
      }
      case 'join': {
        const room = this.rooms.get(msg.code);
        if (!room) throw new Error('존재하지 않는 방 코드입니다.');
        if (ctx) this.leave(socket);
        if (msg.token) {
          const m = room.members.find((x) => !x.cpu && x.token === msg.token);
          if (m) {
            const prev = this.memberSocket.get(m.id);
            if (prev && prev !== socket) { this.sockets.delete(prev); try { prev.close(); } catch { /* 무시 */ } }
            m.connected = true;
            room.emptySince = null;
            this.bind(socket, room, m);
            if (room.game) room.schedule([]);
            return;
          }
        }
        const m = room.addHuman(msg.name, msg.avatar);
        room.emptySince = null;
        this.bind(socket, room, m);
        return;
      }
      case 'chat':
        if (ctx && msg.text) ctx.room.members.forEach((m) => this.sendTo(this.memberSocket.get(m.id), { type: 'chat', from: ctx.member.name, pid: ctx.member.id, text: msg.text }));
        return;
      case 'leave':
        this.leave(socket);
        return;
      case 'ping':
        this.sendTo(socket, { type: 'pong', t: msg.t });
        return;
      default:
        break;
    }
    if (!ctx) throw new Error('방에 들어가 있지 않습니다.');
    const { room, member } = ctx;
    const host = room.hostId === member.id;
    const needHost = (text = '방장만 할 수 있습니다.') => { if (!host) throw new Error(text); };
    switch (msg.type) {
      case 'addCpu':
        needHost(); room.addCpu(); room.sendLobby(); return;
      case 'removeMember': {
        needHost();
        if (msg.id === member.id) return;
        const t = room.removeMember(msg.id);
        if (!t) return;
        const ts = this.memberSocket.get(t.id);
        if (ts) { this.sendTo(ts, { type: 'kicked' }); this.unbind(ts); }
        room.sendLobby();
        return;
      }
      case 'setMode':
        needHost(); room.setMode(msg.mode); room.sendLobby(); return;
      case 'start':
        needHost('방장만 시작할 수 있습니다.'); room.start(); return;
      case 'action':
        room.act(member.id, msg.action); return;
      case 'rematch':
        needHost(); room.rematch(); return;
      default:
        throw new Error('알 수 없는 요청');
    }
  }

  private leave(socket: Socket): void {
    const ctx = this.sockets.get(socket);
    if (!ctx) return;
    const { room, member } = ctx;
    if (room.game) { this.disconnect(socket); return; }
    this.unbind(socket);
    room.members = room.members.filter((x) => x !== member);
    if (room.hostId === member.id) room.hostId = room.humans()[0]?.id ?? null;
    if (!room.humans().length) { room.dispose(); this.rooms.delete(room.code); return; }
    room.sendLobby();
  }

  disconnect(socket: Socket): void {
    const ctx = this.sockets.get(socket);
    if (!ctx) return;
    const { room, member } = ctx;
    if (!room.game) { this.leave(socket); return; }
    const current = this.memberSocket.get(member.id) === socket;
    this.unbind(socket);
    if (!current) return;
    member.connected = false;
    if (room.hostId === member.id) {
      const other = room.humans().find((h) => h.connected);
      if (other) room.hostId = other.id;
    }
    if (!room.humans().some((h) => h.connected)) room.emptySince = this.now();
    room.sendLobby();
    room.schedule([]);
  }

  collect(): void {
    const now = this.now();
    for (const [code, room] of this.rooms) {
      if (room.emptySince != null && now - room.emptySince > EMPTY_ROOM_TTL) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  dispose(): void {
    const ci = this.deps.clearInterval ?? ((h: unknown) => clearInterval(h as ReturnType<typeof setInterval>));
    ci(this.gc);
    for (const r of this.rooms.values()) r.dispose();
  }
}
