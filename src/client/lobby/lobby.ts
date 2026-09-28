/**
 * @pyramid-spec      design/client/lobby/lobby.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/lobby/lobby.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import type { ClientCtx } from '../ctx';
import type { ConnStatus } from '../connection/connection';
import { initTitle } from './title/title';
import { initRoom } from './room/room';

export interface Lobby {
  renderLobby(): void;
  setConnStatus(status: ConnStatus): void;
  fillCodeFromUrl(search: string): void;
}

export function initLobby(ctx: ClientCtx): Lobby {
  const title = initTitle(ctx);
  const room = initRoom(ctx);
  return { renderLobby: room.render, setConnStatus: title.setConnStatus, fillCodeFromUrl: title.fillCodeFromUrl };
}
