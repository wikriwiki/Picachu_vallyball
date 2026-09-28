/**
 * @pyramid-spec      design/server/server.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/server/server.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import os from 'node:os';
import { WebSocket } from 'ws';
import { startServer, type RunningServer } from './server';

let srv: RunningServer;
afterEach(async () => { await srv?.close(); });

class Client {
  ws: WebSocket;
  msgs: Record<string, any>[] = [];
  private waiters: { pred: (m: Record<string, any>) => boolean; resolve: (m: Record<string, any>) => void }[] = [];
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      this.msgs.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  ready() { return new Promise((r) => this.ws.once('open', r)); }
  send(o: object | string) { this.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
  wait(pred: (m: Record<string, any>) => boolean, ms = 15000) {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise<Record<string, any>>((resolve, reject) => {
      this.waiters.push({ pred, resolve });
      setTimeout(() => reject(new Error('timeout')), ms);
    });
  }
}

describe('server 통합', () => {
  it('health', async () => {
    srv = await startServer({ port: 0, staticDir: os.tmpdir() });
    const body = await new Promise<string>((resolve) => http.get(`http://127.0.0.1:${srv.port}/health`, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve(b)); }));
    expect(body).toBe('ok');
  });

  it('두 클라이언트가 같은 방에서 시작하면 둘 다 state 를 받는다', async () => {
    srv = await startServer({ port: 0, staticDir: os.tmpdir(), delayScale: 0.01 });
    const a = new Client(srv.port); const b = new Client(srv.port);
    await Promise.all([a.ready(), b.ready()]);
    a.send({ type: 'create', name: '가', mode: 'full' });
    const joined = await a.wait((m) => m.type === 'joined');
    b.send({ type: 'join', code: joined.code, name: '나' });
    await b.wait((m) => m.type === 'joined');
    a.send({ type: 'start' });
    await Promise.all([a.wait((m) => m.type === 'state'), b.wait((m) => m.type === 'state')]);
  });

  it('사람이 조작하지 않아도 CPU·자동 진행으로 결과 발표까지', async () => {
    srv = await startServer({ port: 0, staticDir: os.tmpdir(), delayScale: 0.0005, turnTimeout: 1, disconnectedDelay: 1 });
    const a = new Client(srv.port);
    await a.ready();
    a.send({ type: 'create', name: '주인', mode: 'kids' });
    await a.wait((m) => m.type === 'joined');
    a.send({ type: 'addCpu' });
    a.send({ type: 'addCpu' });
    await a.wait((m) => m.type === 'lobby' && m.room.members.length === 3);
    a.send({ type: 'start' });
    await a.wait((m) => m.type === 'state' && m.state.phase === 'ended', 60000);
  }, 70000);

  it('잘못된 JSON 은 무시, 알 수 없는 타입은 error', async () => {
    srv = await startServer({ port: 0, staticDir: os.tmpdir() });
    const a = new Client(srv.port);
    await a.ready();
    a.send('{bad');
    a.send({ type: 'fly' });
    const e = await a.wait((m) => m.type === 'error');
    expect(e.message).toBe('알 수 없는 요청');
    a.send({ type: 'ping', t: 1 });
    await a.wait((m) => m.type === 'pong');
  });

  it('끊긴 사람이 토큰으로 돌아오면 같은 ID 와 현재 상태', async () => {
    srv = await startServer({ port: 0, staticDir: os.tmpdir() });
    const a = new Client(srv.port); const b = new Client(srv.port);
    await Promise.all([a.ready(), b.ready()]);
    a.send({ type: 'create', name: '가' });
    const ja = await a.wait((m) => m.type === 'joined');
    b.send({ type: 'join', code: ja.code, name: '나' });
    const jb = await b.wait((m) => m.type === 'joined');
    a.send({ type: 'start' });
    await b.wait((m) => m.type === 'state');
    b.ws.close();
    await new Promise((r) => setTimeout(r, 100));
    const b2 = new Client(srv.port);
    await b2.ready();
    b2.send({ type: 'join', code: ja.code, token: jb.token });
    const j2 = await b2.wait((m) => m.type === 'joined');
    expect(j2.playerId).toBe(jb.playerId);
    await b2.wait((m) => m.type === 'state');
  });
});
