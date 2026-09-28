/**
 * @pyramid-spec      design/client/client.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/client/client.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import type { ServerMessage } from '../server/protocol/protocol';
import type { View } from '../view/view';
import type { ClientCtx } from './ctx';
import { initShell } from './shell/shell';
import { createStore } from './store/store';
import { createConnection, type ConnectionDeps } from './connection/connection';
import { createDisplay } from './display/display';
import { createPlayback } from './playback/playback';
import { initLobby } from './lobby/lobby';
import { initControls } from './controls/controls';
import { esc } from './display/display';

export function startClient(doc: Document, deps: { connection?: ConnectionDeps; loadView?: () => Promise<typeof import('../view/view')> } = {}): ClientCtx {
  const shell = initShell(doc);
  const store = createStore();
  const ctx = { doc, shell, store } as ClientCtx;
  let view: View | null = null;
  let viewPromise: Promise<View> | null = null;
  ctx.getView = () => view;
  ctx.ensureView = () => {
    viewPromise ??= (deps.loadView ?? (() => import('../view/view')))().then((m) => {
      const s = ctx.display.sound;
      view = m.createView(shell.el<HTMLCanvasElement>('world'), shell.el<HTMLCanvasElement>('roulette'), { tick: () => s.tick(), ding: () => s.ding() });
      return view;
    });
    return viewPromise;
  };

  const onMessage = (m: ServerMessage) => {
    switch (m.type) {
      case 'joined':
        store.set({ me: m.playerId });
        ctx.connection.saveSession(m.code, m.token);
        try { history.replaceState(null, '', `?room=${m.code}`); } catch { /* 무시 */ }
        break;
      case 'lobby':
        store.set({ room: m.room });
        if (!m.room.started) {
          store.set({ state: null, shown: null, resultShown: false });
          shell.show('lobby');
          ctx.lobby.renderLobby();
        } else ctx.display.renderPlayers();
        break;
      case 'state':
        playback.enqueue(m.state, m.events ?? []);
        break;
      case 'backToLobby':
        ctx.display.hideResult();
        playback.reset();
        store.set({ state: null, shown: null, resultShown: false });
        shell.show('lobby');
        ctx.lobby.renderLobby();
        break;
      case 'chat':
        ctx.display.addLog(`<span class="chat">${esc(m.from)}: ${esc(m.text)}</span>`);
        if (!ctx.display.isLogOpen()) ctx.display.toast(`💬 ${m.from}: ${m.text}`);
        break;
      case 'error':
        ctx.display.toast(m.message, true);
        if (/존재하지 않는 방/.test(m.message)) {
          ctx.connection.clearSession();
          try { history.replaceState(null, '', location.pathname); } catch { /* 무시 */ }
          shell.show('title');
        }
        store.set({ sentSeq: -1 });
        ctx.controls.updateControls();
        break;
      case 'kicked':
        ctx.connection.clearSession();
        ctx.display.toast('방에서 내보내졌습니다.', true);
        shell.show('title');
        break;
      default:
        break;
    }
  };

  ctx.connection = createConnection({
    onMessage,
    onStatus(st) {
      ctx.lobby?.setConnStatus(st);
      if (st === 'closed' && store.get('room')) ctx.display.toast('연결이 끊겼습니다. 재연결 중...', true);
    },
  }, deps.connection);
  ctx.display = createDisplay(ctx);
  const playback = createPlayback(ctx);
  ctx.lobby = initLobby(ctx);
  ctx.controls = initControls(ctx);
  ctx.lobby.fillCodeFromUrl((deps.connection?.location ?? location).search);
  ctx.connection.connect();
  return ctx;
}
