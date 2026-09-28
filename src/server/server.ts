/**
 * @pyramid-spec      design/server/server.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/server/server.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomManager } from './room-manager/room-manager';
import { createHttpServer } from './http/http';
import { parseClientMessage } from './protocol/protocol';

export interface ServerOptions { port?: number; staticDir?: string; delayScale?: number; turnTimeout?: number; disconnectedDelay?: number; }
export interface RunningServer { port: number; close(): Promise<void>; }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const rooms = new RoomManager({
    delayScale: opts.delayScale ?? 1,
    turnTimeout: opts.turnTimeout ?? 90000,
    disconnectedDelay: opts.disconnectedDelay ?? 6000,
  });
  const httpServer = createHttpServer({
    staticDir: opts.staticDir ?? path.join(ROOT, 'dist', 'client'),
    onSocket: (socket) => ({
      message(text) {
        try {
          const msg = parseClientMessage(text);
          if (msg) rooms.handle(socket, msg);
        } catch (e) {
          socket.send(JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : String(e) }));
        }
      },
      close() { rooms.disconnect(socket); },
    }),
  });
  const port = await httpServer.listen(opts.port ?? (Number(process.env.PORT) || 3000));
  return {
    port,
    async close() {
      rooms.dispose();
      await httpServer.close();
    },
  };
}
