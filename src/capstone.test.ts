/**
 * @pyramid-spec      design/capstone.md
 * @pyramid-parent    none
 * @pyramid-on-change 1) design/capstone.md 「수용 기준」 먼저 수정 2) 이 코드 수정
 */
import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import { WebSocket } from 'ws';
import { startServer, type RunningServer } from './server/server';

// capstone 수용 기준 1·2 를 실제 서버와 WebSocket 두 개로 확인한다.
// (결정성·180판은 src/engine/engine.test.ts, 모바일 폭은 브라우저에서 확인)

let srv: RunningServer;
afterEach(async () => { await srv?.close(); });

type Msg = Record<string, any>;
class Client {
  ws: WebSocket;
  msgs: Msg[] = [];
  private waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      this.msgs.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  ready() { return new Promise((r) => this.ws.once('open', r)); }
  send(o: object) { this.ws.send(JSON.stringify(o)); }
  wait(pred: (m: Msg) => boolean, ms = 60000) {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise<Msg>((resolve, reject) => {
      this.waiters.push({ pred, resolve });
      setTimeout(() => reject(new Error('timeout')), ms);
    });
  }
}

async function twoHumansTwoCpus(opts: Parameters<typeof startServer>[0]) {
  srv = await startServer(opts);
  const a = new Client(srv.port); const b = new Client(srv.port);
  await Promise.all([a.ready(), b.ready()]);
  a.send({ type: 'create', name: '가', mode: 'kids' });
  const ja = await a.wait((m) => m.type === 'joined');
  b.send({ type: 'join', code: ja.code, name: '나' });
  const jb = await b.wait((m) => m.type === 'joined');
  a.send({ type: 'addCpu' });
  a.send({ type: 'addCpu' });
  await a.wait((m) => m.type === 'lobby' && m.room.members.length === 4);
  a.send({ type: 'start' });
  return { a, b, ja, jb };
}

describe('capstone 수용 기준', () => {
  it('두 사람이 방 만들기·참가, CPU 둘 추가 후 시작하면 끝까지 진행되고 네 명의 순위가 나온다', async () => {
    const { a, b } = await twoHumansTwoCpus({ port: 0, staticDir: os.tmpdir(), delayScale: 0.0005, turnTimeout: 1, disconnectedDelay: 1 });
    const [ea, eb] = await Promise.all([
      a.wait((m) => m.type === 'state' && m.state.phase === 'ended'),
      b.wait((m) => m.type === 'state' && m.state.phase === 'ended'),
    ]);
    expect(ea.state.result.ranking).toHaveLength(4);
    expect(eb.state.result.ranking).toEqual(ea.state.result.ranking);
  }, 70000);

  it('끊긴 플레이어의 차례는 자동 진행되고, 같은 토큰으로 돌아오면 진행 중인 상태를 받는다', async () => {
    const { a, b, ja, jb } = await twoHumansTwoCpus({ port: 0, staticDir: os.tmpdir(), delayScale: 0.0005, turnTimeout: 60000, disconnectedDelay: 1 });
    const first = await b.wait((m) => m.type === 'state');
    b.ws.close();
    // 가(방장)도 조작하지 않도록 끊는다 → 두 사람 모두 끊긴 자동 진행으로만 게임이 흘러가야 한다
    a.ws.close();
    await new Promise((r) => setTimeout(r, 300));
    const b2 = new Client(srv.port);
    await b2.ready();
    b2.send({ type: 'join', code: ja.code, token: jb.token });
    const j2 = await b2.wait((m) => m.type === 'joined');
    expect(j2.playerId).toBe(jb.playerId);
    const st = await b2.wait((m) => m.type === 'state');
    expect(st.state.seq).toBeGreaterThan(first.state.seq);
  }, 70000);
});
