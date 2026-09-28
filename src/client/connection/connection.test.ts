/**
 * @pyramid-spec      design/client/connection/connection.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/connection/connection.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { createConnection, SESSION_KEY, type ConnStatus, type WebSocketLike } from './connection';

function setup(search = '', session?: object, throwing = false) {
  const sockets: FakeWS[] = [];
  class FakeWS implements WebSocketLike {
    readyState = 0; sent: string[] = [];
    onopen: (() => void) | null = null; onmessage: ((ev: { data: string }) => void) | null = null; onclose: (() => void) | null = null;
    constructor(public url: string) { sockets.push(this); }
    send(d: string) { this.sent.push(d); }
    open() { this.readyState = 1; this.onopen?.(); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  const store = new Map<string, string>(session ? [[SESSION_KEY, JSON.stringify(session)]] : []);
  const storage = throwing
    ? { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } }
    : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  const timeouts: { fn: () => void; ms: number }[] = [];
  const intervals: { fn: () => void; ms: number }[] = [];
  const statuses: ConnStatus[] = [];
  const messages: unknown[] = [];
  const conn = createConnection({ onMessage: (m) => messages.push(m), onStatus: (s) => statuses.push(s) }, {
    WebSocketImpl: FakeWS, storage, location: { protocol: 'https:', host: 'a.b', search },
    setTimeout: (fn, ms) => timeouts.push({ fn, ms }), setInterval: (fn, ms) => intervals.push({ fn, ms }), now: () => 7,
  });
  return { conn, sockets, statuses, messages, timeouts, intervals };
}

describe('connection', () => {
  it('1: 주소', () => {
    const { conn, sockets, statuses } = setup();
    conn.connect();
    expect(sockets[0].url).toBe('wss://a.b/ws');
    expect(statuses).toEqual(['connecting']);
  });
  it('2: 연결 전 메시지 순서', () => {
    const { conn, sockets } = setup();
    conn.connect();
    conn.send({ type: 'start' }); conn.send({ type: 'chat', text: 'hi' });
    sockets[0].open();
    expect(sockets[0].sent.map((s) => JSON.parse(s).type)).toEqual(['start', 'chat']);
  });
  it('3: 세션 재입장', () => {
    const { conn, sockets } = setup('', { code: 'ABCD', token: 't' });
    conn.connect(); sockets[0].open();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({ type: 'join', code: 'ABCD', token: 't' });
  });
  it('4: 다른 방 주소', () => {
    const { conn, sockets } = setup('?room=wxyz', { code: 'ABCD', token: 't' });
    conn.connect(); sockets[0].open();
    expect(sockets[0].sent.length).toBe(0);
  });
  it('5: 소문자 방 주소', () => {
    const { conn, sockets } = setup('?room=abcd', { code: 'ABCD', token: 't' });
    conn.connect(); sockets[0].open();
    expect(sockets[0].sent.length).toBe(1);
  });
  it('6: 메시지 해석', () => {
    const { conn, sockets, messages } = setup();
    conn.connect(); sockets[0].open();
    sockets[0].onmessage!({ data: '{"type":"pong","t":1}' });
    sockets[0].onmessage!({ data: '{bad' });
    expect(messages).toEqual([{ type: 'pong', t: 1 }]);
  });
  it('7: 재연결 지연', () => {
    const { conn, sockets, timeouts } = setup();
    conn.connect();
    for (let i = 0; i < 3; i++) { sockets[i].close(); timeouts[i].fn(); }
    expect(timeouts.map((t) => t.ms)).toEqual([800, 1600, 3200]);
    expect(sockets.length).toBe(4);
  });
  it('8: 열리면 초기화', () => {
    const { conn, sockets, timeouts } = setup();
    conn.connect();
    sockets[0].close(); timeouts[0].fn();
    sockets[1].close(); timeouts[1].fn();
    sockets[2].open(); sockets[2].close();
    expect(timeouts[2].ms).toBe(800);
  });
  it('9: ping 은 쌓이지 않음', () => {
    const { conn, sockets } = setup();
    conn.connect();
    conn.send({ type: 'ping', t: 1 });
    sockets[0].open();
    expect(sockets[0].sent.length).toBe(0);
  });
  it('10: 저장소 예외', () => {
    const { conn } = setup('', undefined, true);
    expect(() => { conn.saveSession('A', 'b'); conn.clearSession(); }).not.toThrow();
    expect(conn.loadSession()).toBeNull();
  });
  it('11: ping 타이머', () => {
    const { conn, intervals, sockets } = setup();
    expect(intervals.length).toBe(1);
    expect(intervals[0].ms).toBe(25000);
    conn.connect(); sockets[0].open();
    intervals[0].fn();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({ type: 'ping', t: 7 });
  });
});
