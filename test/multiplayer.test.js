// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 멀티플레이 통합 테스트: 실제 서버 + WebSocket 클라이언트 2명 + CPU 1명으로 끝까지 플레이, 중간 재접속 포함
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';
import { cpuAction } from '../shared/engine.js';

const { server } = await startServer(0, { delayScale: 0, turnTimeout: 60000, disconnectedDelay: 50 });
const port = server.address().port;
const url = `ws://localhost:${port}/ws`;

// 정적 파일 확인
for (const p of ['/', '/js/main.js', '/shared/engine.js', '/vendor/three/three.module.js', '/health']) {
  const r = await fetch(`http://localhost:${port}${p}`);
  assert.equal(r.status, 200, p);
}
assert.equal((await fetch(`http://localhost:${port}/../package.json`)).status, 404);

function client(name) {
  const ws = new WebSocket(url);
  const c = { ws, name, state: null, lobby: null, me: null, token: null, code: null, errors: [], waiters: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'joined') { c.me = m.playerId; c.token = m.token; c.code = m.code; }
    if (m.type === 'lobby') c.lobby = m.room;
    if (m.type === 'state') c.state = m.state;
    if (m.type === 'error') c.errors.push(m.message);
    c.waiters = c.waiters.filter((w) => !w());
    if (m.type === 'state' && c.auto) c.auto();
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = (fn, ms = 20000) => new Promise((res, rej) => {
    if (fn()) return res();
    const t = setTimeout(() => rej(new Error(name + ' timeout')), ms);
    c.waiters.push(() => { if (fn()) { clearTimeout(t); res(); return true; } return false; });
  });
  c.enableAuto = () => {
    c.auto = () => {
      const s = c.state;
      if (s && s.phase === 'playing' && s.pending && s.pending.playerId === c.me) {
        const key = s.seq + ':' + s.pending.type;
        if (c.lastKey === key) return;
        c.lastKey = key;
        c.send({ type: 'action', action: cpuAction(s) });
      }
    };
    c.auto();
  };
  return c;
}

const a = client('A');
await a.open;
a.send({ type: 'create', name: '앨리스', avatar: { shirt: '#123456' }, mode: 'full' });
await a.until(() => a.lobby);
const b = client('B');
await b.open;
b.send({ type: 'join', code: a.code.toLowerCase(), name: '<b>밥</b>' });
await b.until(() => b.lobby && b.lobby.members.length === 2);
assert.equal(b.lobby.members[1].name, 'b밥/b');
b.send({ type: 'start' });
await b.until(() => b.errors.length === 1);
a.send({ type: 'addCpu' });
await a.until(() => a.lobby.members.length === 3);
a.send({ type: 'start' });
await a.until(() => a.state);
await b.until(() => b.state);
a.enableAuto();

// B는 중간에 끊겼다가 재접속
let reconnected = false;
b.enableAuto();
await b.until(() => b.state.era >= 2, 60000);
b.ws.close();
await a.until(() => a.state.era >= 3, 60000);
const b2 = client('B2');
await b2.open;
b2.me = b.me;
b2.send({ type: 'join', code: a.code, token: b.token });
await b2.until(() => b2.state);
assert.equal(b2.me, b.me);
reconnected = true;
b2.enableAuto();

await a.until(() => a.state.phase === 'ended', 120000);
await b2.until(() => b2.state && b2.state.phase === 'ended', 10000);
assert.ok(reconnected);
assert.equal(a.state.result.ranking.length, 3);
console.log('multiplayer ok — room', a.code, 'ranking', a.state.result.rows.map((r) => r.total));

// 재대결 → 로비 복귀
a.send({ type: 'rematch' });
await a.until(() => a.lobby && !a.lobby.started);
a.ws.close(); b2.ws.close();
server.close();
process.exit(0);
