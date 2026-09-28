/**
 * @pyramid-spec      design/client/connection/connection.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/connection/connection.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { ClientMessage, ServerMessage } from '../../server/protocol/protocol';

export type ConnStatus = 'connecting' | 'open' | 'closed';
export interface Session { code: string; token: string; }
export interface Connection {
  connect(): void;
  send(msg: ClientMessage): void;
  saveSession(code: string, token: string): void;
  clearSession(): void;
  loadSession(): Session | null;
}
export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
}
export interface ConnectionDeps {
  WebSocketImpl?: new (url: string) => WebSocketLike;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  location?: { protocol: string; host: string; search: string };
  setTimeout?: (fn: () => void, ms: number) => unknown;
  setInterval?: (fn: () => void, ms: number) => unknown;
  now?: () => number;
}
export const SESSION_KEY = 'life.session';

export function createConnection(
  handlers: { onMessage(msg: ServerMessage): void; onStatus(status: ConnStatus): void },
  deps: ConnectionDeps = {},
): Connection {
  const WS = deps.WebSocketImpl ?? (globalThis.WebSocket as unknown as new (url: string) => WebSocketLike);
  const storage = () => deps.storage ?? globalThis.sessionStorage;
  const loc = () => deps.location ?? globalThis.location;
  const st = deps.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const si = deps.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
  const now = deps.now ?? Date.now;
  let ws: WebSocketLike | null = null;
  const outbox: string[] = [];
  let retry = 0;

  const loadSession = (): Session | null => {
    try {
      const v = JSON.parse(storage().getItem(SESSION_KEY) || 'null');
      return v && typeof v.code === 'string' && typeof v.token === 'string' ? v : null;
    } catch { return null; }
  };

  const conn: Connection = {
    connect() {
      handlers.onStatus('connecting');
      const l = loc();
      const url = `${l.protocol === 'https:' ? 'wss:' : 'ws:'}//${l.host}/ws`;
      const sock = new WS(url);
      ws = sock;
      sock.onopen = () => {
        retry = 0;
        handlers.onStatus('open');
        const sess = loadSession();
        const room = new URLSearchParams(loc().search).get('room');
        if (sess && (!room || room.toUpperCase() === sess.code)) sock.send(JSON.stringify({ type: 'join', code: sess.code, token: sess.token }));
        for (const m of outbox.splice(0)) sock.send(m);
      };
      sock.onmessage = (ev) => {
        let m: ServerMessage;
        try { m = JSON.parse(ev.data); } catch { return; }
        handlers.onMessage(m);
      };
      sock.onclose = () => {
        handlers.onStatus('closed');
        const delay = Math.min(8000, 800 * 2 ** retry++);
        st(() => conn.connect(), delay);
      };
    },
    send(msg) {
      const s = JSON.stringify(msg);
      if (ws && ws.readyState === 1) ws.send(s);
      else if (msg.type !== 'ping') outbox.push(s);
    },
    saveSession(code, token) { try { storage().setItem(SESSION_KEY, JSON.stringify({ code, token })); } catch { /* 무시 */ } },
    clearSession() { try { storage().removeItem(SESSION_KEY); } catch { /* 무시 */ } },
    loadSession,
  };
  si(() => conn.send({ type: 'ping', t: now() }), 25000);
  return conn;
}
