/**
 * @pyramid-spec      design/server/protocol/protocol.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/protocol/protocol.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import type { Action, PublicState, GameEvent, Mode } from '../../engine/engine';
import { AVATAR_DEFAULT, type Avatar } from '../../data/data';

export const MODES: readonly Mode[] = ['full', 'adult', 'kids'];
export const MAX_PLAYERS = 4;
export interface MemberInfo { id: string; name: string; avatar: Avatar; cpu: boolean; connected: boolean; }
export interface LobbyInfo { code: string; hostId: string | null; mode: Mode; started: boolean; members: MemberInfo[]; }

export type ClientMessage =
  | { type: 'create'; name: string; avatar: Avatar; mode: Mode }
  | { type: 'join'; code: string; token?: string; name: string; avatar: Avatar }
  | { type: 'chat'; text: string }
  | { type: 'leave' }
  | { type: 'ping'; t: number }
  | { type: 'addCpu' }
  | { type: 'removeMember'; id: string }
  | { type: 'setMode'; mode: Mode }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  | { type: 'rematch' };

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string; token: string }
  | { type: 'lobby'; room: LobbyInfo }
  | { type: 'state'; state: PublicState; events: GameEvent[]; seq: number }
  | { type: 'chat'; from: string; pid: string; text: string }
  | { type: 'error'; message: string }
  | { type: 'kicked' }
  | { type: 'backToLobby' }
  | { type: 'pong'; t: number };

export class ProtocolError extends Error {
  override readonly name = 'ProtocolError';
}

const isMode = (m: unknown): m is Mode => typeof m === 'string' && (MODES as readonly string[]).includes(m);
const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function sanitizeName(name: unknown): string {
  const s = String(name ?? '').replace(/[<>&"']/g, '').trim().slice(0, 10);
  return s || '플레이어';
}

export function sanitizeAvatar(avatar: unknown): Avatar {
  const a = (avatar && typeof avatar === 'object' ? avatar : {}) as Record<string, unknown>;
  const color = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) | 0));
  return {
    skin: color(a.skin, AVATAR_DEFAULT.skin), hair: color(a.hair, AVATAR_DEFAULT.hair),
    shirt: color(a.shirt, AVATAR_DEFAULT.shirt), pants: color(a.pants, AVATAR_DEFAULT.pants),
    hairStyle: int(a.hairStyle, 3), face: int(a.face, 2),
  };
}

function parseAction(a: unknown): Action {
  const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
  if (o.type === 'spin') return { type: 'spin', power: finite(o.power) ?? 0 };
  if (o.type === 'choose') return { type: 'choose', index: Math.floor(finite(o.index) ?? 0) };
  if (o.type === 'card') {
    const out: Action = { type: 'card', index: Math.floor(finite(o.index) ?? 0) };
    const n = finite(o.number);
    if (n != null) out.number = Math.floor(n);
    return out;
  }
  throw new ProtocolError('알 수 없는 조작입니다.');
}

export function parseClientMessage(raw: string): ClientMessage | null {
  let m: unknown;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const o = m as Record<string, unknown>;
  if (typeof o.type !== 'string') return null;
  switch (o.type) {
    case 'create':
      return { type: 'create', name: sanitizeName(o.name), avatar: sanitizeAvatar(o.avatar), mode: isMode(o.mode) ? o.mode : 'full' };
    case 'join': {
      const msg: ClientMessage = { type: 'join', code: String(o.code ?? '').trim().toUpperCase(), name: sanitizeName(o.name), avatar: sanitizeAvatar(o.avatar) };
      if (typeof o.token === 'string' && o.token) msg.token = o.token;
      return msg;
    }
    case 'chat': return { type: 'chat', text: String(o.text ?? '').slice(0, 120).trim() };
    case 'ping': return { type: 'ping', t: finite(o.t) ?? 0 };
    case 'removeMember': return { type: 'removeMember', id: String(o.id ?? '') };
    case 'setMode':
      if (!isMode(o.mode)) throw new ProtocolError('알 수 없는 모드입니다.');
      return { type: 'setMode', mode: o.mode };
    case 'action': return { type: 'action', action: parseAction(o.action) };
    case 'leave': case 'addCpu': case 'start': case 'rematch':
      return { type: o.type };
    default:
      throw new ProtocolError('알 수 없는 요청');
  }
}
