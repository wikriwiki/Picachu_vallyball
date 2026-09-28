/**
 * @pyramid-spec      design/client/client.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/client/client.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
import type { View } from '../view/view';
import type { Connection } from './connection/connection';
import type { Store } from './store/store';
import type { Shell } from './shell/shell';
import type { Display } from './display/display';
import type { Lobby } from './lobby/lobby';
import type { Controls } from './controls/controls';

export interface ClientCtx {
  doc: Document;
  shell: Shell;
  store: Store;
  connection: Connection;
  display: Display;
  lobby: Lobby;
  controls: Controls;
  getView(): View | null;
  ensureView(): Promise<View>;
}
