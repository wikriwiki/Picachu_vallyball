/**
 * @pyramid-spec      design/server/http/http.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/http/http.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import type { Socket } from '../room-manager/room-manager';

export interface SocketHandlers { message(text: string): void; close(): void; }
export interface HttpServerOptions { staticDir: string; onSocket(socket: Socket): SocketHandlers; heartbeatMs?: number; }
export interface HttpServer { listen(port: number): Promise<number>; close(): Promise<void>; }

export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

type AliveWs = WebSocket & { alive?: boolean };

export function createHttpServer(opts: HttpServerOptions): HttpServer {
  const root = path.resolve(opts.staticDir);
  const server = http.createServer((req, res) => {
    let urlPath: string;
    try { urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
    if (urlPath === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.resolve(root, '.' + urlPath);
    if (!file.startsWith(root + path.sep)) { res.writeHead(404); res.end('not found'); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'content-type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        'cache-control': urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (ws: AliveWs) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const socket: Socket = {
      send: (text) => { if (ws.readyState === WebSocket.OPEN) ws.send(text); },
      close: () => ws.close(),
      get isOpen() { return ws.readyState === WebSocket.OPEN; },
    };
    const h = opts.onSocket(socket);
    ws.on('message', (data) => { try { h.message(data.toString()); } catch { /* 서버는 계속 돈다 */ } });
    ws.on('close', () => { try { h.close(); } catch { /* 무시 */ } });
  });
  const hb = setInterval(() => {
    for (const ws of wss.clients as Set<AliveWs>) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, opts.heartbeatMs ?? 20000);
  hb.unref?.();

  return {
    listen: (port) => new Promise((resolve) => server.listen(port, () => resolve((server.address() as AddressInfo).port))),
    close: () => new Promise((resolve) => {
      clearInterval(hb);
      for (const ws of wss.clients) ws.terminate();
      wss.close(() => server.close(() => resolve()));
      server.closeAllConnections?.();
    }),
  };
}
