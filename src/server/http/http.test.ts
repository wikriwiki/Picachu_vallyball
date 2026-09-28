/**
 * @pyramid-spec      design/server/http/http.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/http/http.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createHttpServer, type HttpServer, type SocketHandlers } from './http';

let dir: string;
let srv: HttpServer;
let port: number;
let closes = 0;

const get = (p: string) => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
  });
  req.on('error', reject);
  req.end();
});

async function open(heartbeatMs?: number, handlers?: (s: { send(t: string): void }) => SocketHandlers) {
  srv = createHttpServer({
    staticDir: dir, heartbeatMs,
    onSocket: (s) => (handlers ? handlers(s) : { message: (t) => s.send(t), close: () => { closes++; } }),
  });
  port = await srv.listen(0);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-http-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'a.js'), 'x');
  closes = 0;
});
afterEach(async () => { await srv?.close(); });

describe('http', () => {
  it('1: health', async () => { await open(); expect(await get('/health')).toMatchObject({ status: 200, body: 'ok' }); });
  it('2: index', async () => {
    await open();
    const r = await get('/');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.headers['cache-control']).toBe('no-cache');
    expect(r.body).toBe('<h1>hi</h1>');
  });
  it('3: assets 캐시', async () => {
    await open();
    const r = await get('/assets/a.js');
    expect(r.headers['content-type']).toContain('javascript');
    expect(r.headers['cache-control']).toContain('immutable');
  });
  it('4: 없는 파일', async () => { await open(); expect((await get('/nope.txt')).status).toBe(404); });
  it('5: 경로 이탈', async () => { await open(); expect((await get('/../package.json')).status).toBe(404); });
  it('6: 잘못된 인코딩', async () => { await open(); expect((await get('/%E0%A4%A')).status).toBe(400); });
  it('7·8: 웹소켓 에코와 종료', async () => {
    await open();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const got = await new Promise<string>((resolve) => { ws.on('open', () => ws.send('hi')); ws.on('message', (d) => resolve(d.toString())); });
    expect(got).toBe('hi');
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(closes).toBe(1);
  });
  it('9: 하트비트로 끊기', async () => {
    await open(50);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { autoPong: false } as never);
    await new Promise((r) => ws.on('open', r));
    const closed = await new Promise<boolean>((resolve) => { ws.on('close', () => resolve(true)); setTimeout(() => resolve(false), 1000); });
    expect(closed).toBe(true);
  });
  it('10: 닫기', async () => {
    await open();
    await srv.close();
    await expect(get('/health')).rejects.toBeTruthy();
    srv = { listen: async () => 0, close: async () => {} };
  });
});
