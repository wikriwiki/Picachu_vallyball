// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 방(로비) 관리 + 게임 진행
import crypto from 'node:crypto';
import { createGame, applyAction, cpuAction, publicState } from '../shared/engine.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MODES = ['full', 'adult', 'kids'];
const CPU_NAMES = ['CPU 하나', 'CPU 두리', 'CPU 세찌', 'CPU 네찌'];
const CPU_COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419'];

function sanitizeName(n) {
  return String(n || '').replace(/[<>&"']/g, '').trim().slice(0, 10) || '플레이어';
}
function sanitizeAvatar(a) {
  a = a && typeof a === 'object' ? a : {};
  const color = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const int = (v, max) => Math.max(0, Math.min(max, Number(v) | 0));
  return {
    skin: color(a.skin, '#f5d0b0'), hair: color(a.hair, '#4a3020'), shirt: color(a.shirt, '#ff6b6b'),
    pants: color(a.pants, '#364fc7'), hairStyle: int(a.hairStyle, 3), face: int(a.face, 2),
  };
}

// 이벤트 연출 시간 추정 (CPU/자동 진행 대기 시간)
export function estimateMs(events) {
  let ms = 400;
  for (const e of events) {
    if (e.t === 'spin') ms += e.auto ? 1400 : 2800;
    else if (e.t === 'move') ms += e.path.length * 280 + 200;
    else if (e.t === 'msg') ms += 1300;
    else if (e.t === 'era') ms += 2600;
    else if (e.t === 'marry' || e.t === 'kid' || e.t === 'goal') ms += 1500;
    else if (e.t === 'result') ms += 4000;
    else ms += 60;
  }
  return Math.min(ms, 20000);
}

class Room {
  constructor(mgr, code, opts) {
    this.mgr = mgr;
    this.code = code;
    this.opts = opts;
    this.members = []; // {id, token, name, avatar, cpu, ws, connected}
    this.hostId = null;
    this.mode = 'full';
    this.game = null;
    this.timer = null;
    this.emptySince = null;
  }

  get humans() { return this.members.filter((m) => !m.cpu); }

  send(ws, obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }
  broadcast(obj) {
    const s = JSON.stringify(obj);
    for (const m of this.members) if (m.ws && m.ws.readyState === 1) m.ws.send(s);
  }
  lobbyInfo() {
    return {
      code: this.code, hostId: this.hostId, mode: this.mode, started: !!this.game,
      members: this.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, cpu: m.cpu, connected: m.cpu || m.connected })),
    };
  }
  sendLobby() { this.broadcast({ type: 'lobby', room: this.lobbyInfo() }); }

  addHuman(ws, name, avatar) {
    if (this.game) throw new Error('이미 게임이 시작된 방입니다.');
    if (this.members.length >= 4) throw new Error('방이 가득 찼습니다. (최대 4명)');
    const m = { id: 'u' + crypto.randomBytes(4).toString('hex'), token: crypto.randomBytes(12).toString('hex'), name: sanitizeName(name), avatar: sanitizeAvatar(avatar), cpu: false, ws, connected: true };
    this.members.push(m);
    if (!this.hostId) this.hostId = m.id;
    return m;
  }

  addCpu() {
    if (this.game) throw new Error('게임 중에는 추가할 수 없습니다.');
    if (this.members.length >= 4) throw new Error('방이 가득 찼습니다.');
    const idx = this.members.filter((m) => m.cpu).length;
    const hs = idx % 4;
    this.members.push({
      id: 'c' + crypto.randomBytes(4).toString('hex'), name: CPU_NAMES[idx % 4], cpu: true, connected: true,
      avatar: sanitizeAvatar({ shirt: CPU_COLORS[idx % 4], hairStyle: hs, hair: ['#2b2b2b', '#8a5a2b', '#e0b050', '#c0392b'][hs] }),
    });
  }

  start() {
    if (this.game) throw new Error('이미 시작했습니다.');
    if (this.members.length < 1) throw new Error('플레이어가 없습니다.');
    this.game = createGame({
      players: this.members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, cpu: m.cpu })),
      mode: this.mode,
      seed: crypto.randomBytes(4).readUInt32LE(0),
    });
    this.sendLobby();
    this.pushState(this.game.lastEvents || []);
  }

  pushState(events) {
    this.broadcast({ type: 'state', state: publicState(this.game), events, seq: this.game.seq });
    this.schedule(events);
  }

  schedule(events) {
    clearTimeout(this.timer);
    this.timer = null;
    const g = this.game;
    if (!g || g.phase !== 'playing' || !g.pending) return;
    const m = this.members.find((x) => x.id === g.pending.playerId);
    const anim = estimateMs(events) * this.opts.delayScale;
    let delay;
    if (!m || m.cpu) delay = anim + 700 * this.opts.delayScale;
    else if (!m.connected) delay = anim + this.opts.disconnectedDelay;
    else delay = anim + this.opts.turnTimeout;
    const seq = g.seq;
    this.timer = setTimeout(() => {
      if (!this.game || this.game.seq !== seq) return;
      this.autoAct();
    }, delay);
  }

  autoAct() {
    const g = this.game;
    if (!g.pending) return;
    const a = cpuAction(g);
    if (a) this.act(g.pending.playerId, a);
  }

  act(playerId, action) {
    const events = applyAction(this.game, playerId, action);
    this.pushState(events);
  }

  dispose() { clearTimeout(this.timer); }
}

export class RoomManager {
  constructor(opts = {}) {
    this.opts = { delayScale: 1, turnTimeout: 90000, disconnectedDelay: 6000, ...opts };
    this.rooms = new Map();
    this.sockets = new Map(); // ws -> {room, member}
    this.gc = setInterval(() => this.collect(), 60000);
  }

  newCode() {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(c)) return c;
    }
  }

  bind(ws, room, m) {
    this.sockets.set(ws, { room, member: m });
    room.send(ws, { type: 'joined', code: room.code, playerId: m.id, token: m.token });
    room.sendLobby();
    if (room.game) room.send(ws, { type: 'state', state: publicState(room.game), events: [], seq: room.game.seq });
  }

  handle(ws, msg) {
    const ctx = this.sockets.get(ws);
    switch (msg.type) {
      case 'create': {
        if (ctx) this.leave(ws);
        const room = new Room(this, this.newCode(), this.opts);
        if (MODES.includes(msg.mode)) room.mode = msg.mode;
        this.rooms.set(room.code, room);
        const m = room.addHuman(ws, msg.name, msg.avatar);
        this.bind(ws, room, m);
        return;
      }
      case 'join': {
        const code = String(msg.code || '').toUpperCase().trim();
        const room = this.rooms.get(code);
        if (!room) throw new Error('존재하지 않는 방 코드입니다.');
        if (ctx) this.leave(ws);
        if (msg.token) {
          const m = room.members.find((x) => !x.cpu && x.token === msg.token);
          if (m) {
            if (m.ws && m.ws !== ws) { this.sockets.delete(m.ws); try { m.ws.close(); } catch { /* ignore */ } }
            m.ws = ws;
            m.connected = true;
            room.emptySince = null;
            this.bind(ws, room, m);
            if (room.game) room.schedule([]);
            return;
          }
        }
        const m = room.addHuman(ws, msg.name, msg.avatar);
        room.emptySince = null;
        this.bind(ws, room, m);
        return;
      }
      case 'chat': {
        if (!ctx) return;
        const text = String(msg.text || '').slice(0, 120).trim();
        if (text) ctx.room.broadcast({ type: 'chat', from: ctx.member.name, pid: ctx.member.id, text });
        return;
      }
      case 'leave':
        this.leave(ws);
        return;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
        return;
      default:
        break;
    }
    if (!ctx) throw new Error('방에 들어가 있지 않습니다.');
    const { room, member } = ctx;
    const isHost = room.hostId === member.id;
    switch (msg.type) {
      case 'addCpu':
        if (!isHost) throw new Error('방장만 할 수 있습니다.');
        room.addCpu();
        room.sendLobby();
        break;
      case 'removeMember': {
        if (!isHost) throw new Error('방장만 할 수 있습니다.');
        if (room.game) throw new Error('게임 중에는 할 수 없습니다.');
        const t = room.members.find((x) => x.id === msg.id);
        if (!t || t.id === member.id) return;
        room.members = room.members.filter((x) => x !== t);
        if (t.ws) { room.send(t.ws, { type: 'kicked' }); this.sockets.delete(t.ws); }
        room.sendLobby();
        break;
      }
      case 'setMode':
        if (!isHost) throw new Error('방장만 할 수 있습니다.');
        if (room.game) return;
        if (MODES.includes(msg.mode)) room.mode = msg.mode;
        room.sendLobby();
        break;
      case 'start':
        if (!isHost) throw new Error('방장만 시작할 수 있습니다.');
        room.start();
        break;
      case 'action':
        if (!room.game) throw new Error('게임이 시작되지 않았습니다.');
        room.act(member.id, msg.action || {});
        break;
      case 'rematch':
        if (!isHost) throw new Error('방장만 할 수 있습니다.');
        if (!room.game || room.game.phase !== 'ended') return;
        room.dispose();
        room.game = null;
        room.members = room.members.filter((x) => x.cpu || x.connected);
        room.sendLobby();
        room.broadcast({ type: 'backToLobby' });
        break;
      default:
        throw new Error('알 수 없는 요청');
    }
  }

  leave(ws) {
    const ctx = this.sockets.get(ws);
    if (!ctx) return;
    const { room, member } = ctx;
    if (room.game) { this.disconnect(ws); return; }
    this.sockets.delete(ws);
    room.members = room.members.filter((x) => x !== member);
    if (room.hostId === member.id) room.hostId = room.humans[0] ? room.humans[0].id : null;
    if (!room.humans.length) { room.dispose(); this.rooms.delete(room.code); return; }
    room.sendLobby();
  }

  disconnect(ws) {
    const ctx = this.sockets.get(ws);
    if (!ctx) return;
    const { room, member } = ctx;
    if (!room.game) { this.leave(ws); return; }
    this.sockets.delete(ws);
    if (member.ws !== ws) return;
    member.connected = false;
    member.ws = null;
    if (room.hostId === member.id) {
      const other = room.humans.find((h) => h.connected);
      if (other) room.hostId = other.id;
    }
    if (!room.humans.some((h) => h.connected)) room.emptySince = Date.now();
    room.sendLobby();
    room.schedule([]);
  }

  collect() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.emptySince && now - room.emptySince > 10 * 60 * 1000) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  dispose() {
    clearInterval(this.gc);
    for (const r of this.rooms.values()) r.dispose();
  }
}
