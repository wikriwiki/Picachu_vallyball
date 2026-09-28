/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/client.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/client/client.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { AVATAR_DEFAULT } from '../data/data';
import { fakeView, loadDom, sampleState } from './testkit';
import { startClient } from './client';
import type { WebSocketLike } from './connection/connection';

function setup() {
  loadDom();
  const sockets: FakeWS[] = [];
  class FakeWS implements WebSocketLike {
    readyState = 0; sent: string[] = [];
    onopen: (() => void) | null = null; onmessage: ((ev: { data: string }) => void) | null = null; onclose: (() => void) | null = null;
    constructor() { sockets.push(this); }
    send(d: string) { this.sent.push(d); }
  }
  const store = new Map<string, string>();
  const view = fakeView();
  const ctx = startClient(document, {
    connection: {
      WebSocketImpl: FakeWS, location: { protocol: 'http:', host: 'x', search: '' },
      storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); }, removeItem: (k) => { store.delete(k); } },
      setInterval: () => 0, setTimeout: () => 0,
    },
    loadView: async () => ({ createView: () => view }) as never,
  });
  const ws = sockets[0];
  ws.readyState = 1; ws.onopen!();
  const recv = (m: object) => ws.onmessage!({ data: JSON.stringify(m) });
  return { ctx, ws, recv, view, store };
}
const lobby = (members: object[], started = false) => ({ type: 'lobby', room: { code: 'ABCD', hostId: 'p0', mode: 'full', started, members } });
const mem = (id: string, name: string) => ({ id, name, avatar: { ...AVATAR_DEFAULT }, cpu: false, connected: true });
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };

describe('client 통합', () => {
  it('방을 만들면 로비에 방 코드와 방장 표시', () => {
    const { ctx, ws, recv } = setup();
    ctx.shell.el<HTMLInputElement>('inp-name').value = '민수';
    ctx.shell.el('btn-create').click();
    expect(JSON.parse(ws.sent.at(-1)!).type).toBe('create');
    recv({ type: 'joined', code: 'ABCD', playerId: 'p0', token: 't' });
    recv(lobby([mem('p0', '민수')]));
    expect(ctx.shell.current()).toBe('lobby');
    expect(ctx.shell.el('room-code').textContent).toBe('ABCD');
    expect(ctx.shell.el('members').textContent).toContain('방장');
  });
  it('게임 상태를 받으면 게임 화면, 내 차례에만 SPIN', async () => {
    const { ctx, recv } = setup();
    recv({ type: 'joined', code: 'ABCD', playerId: 'p0', token: 't' });
    recv(lobby([mem('p0', 'a'), mem('p1', 'b')], true));
    const s = sampleState();
    recv({ type: 'state', state: s, events: [], seq: s.seq });
    await flush();
    expect(ctx.shell.current()).toBe('game');
    expect(ctx.shell.el<HTMLButtonElement>('btn-spin').disabled).toBe(s.pending!.playerId !== 'p0');
  });
  it('존재하지 않는 방 오류는 세션을 지우고 타이틀로', () => {
    const { ctx, recv, store } = setup();
    store.set('life.session', '{"code":"ZZZZ","token":"x"}');
    recv({ type: 'error', message: '존재하지 않는 방 코드입니다.' });
    expect(store.has('life.session')).toBe(false);
    expect(ctx.shell.current()).toBe('title');
  });
  it('채팅은 기록에 남는다', () => {
    const { ctx, recv } = setup();
    recv({ type: 'chat', from: '<x>', pid: 'p1', text: '안녕' });
    expect(ctx.shell.el('log-list').innerHTML).toContain('&lt;x&gt;: 안녕');
  });
  it('재대결 → 로비', async () => {
    const { ctx, recv } = setup();
    recv({ type: 'joined', code: 'ABCD', playerId: 'p0', token: 't' });
    const s = sampleState();
    recv({ type: 'state', state: s, events: [], seq: 0 });
    await flush();
    recv({ type: 'backToLobby' });
    recv(lobby([mem('p0', 'a')]));
    expect(ctx.shell.current()).toBe('lobby');
    expect(ctx.store.get('state')).toBeNull();
    void vi;
  });
});
