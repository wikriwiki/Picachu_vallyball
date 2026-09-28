/**
 * @pyramid-spec      design/client/shell/shell.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/shell/shell.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import './style.css';

export type ScreenId = 'title' | 'lobby' | 'game';
export const DOM_IDS = [
  'world', 'screen-title', 'avatar-canvas', 'avatar-opts', 'inp-name', 'sel-mode', 'btn-create', 'inp-code', 'btn-join', 'conn-status',
  'screen-lobby', 'room-code', 'btn-copy', 'members', 'lobby-mode', 'btn-cpu', 'btn-start', 'btn-leave', 'lobby-hint',
  'screen-game', 'hud-main', 'hud-portrait', 'hud-name', 'hud-job', 'hud-stats', 'hud-partner', 'hud-money', 'players',
  'turn-box', 'era-name', 'era-turn', 'pay-line', 'cmd-menu', 'cmd-roulette', 'cmd-card', 'cmd-status', 'cmd-other', 'other-menu',
  'btn-view', 'btn-log', 'btn-rules', 'btn-mute', 'msgbox', 'msg-name', 'msg-text', 'prompt', 'hand', 'roulette', 'power-fill',
  'btn-spin', 'floaters', 'log-panel', 'log-list', 'chat-form', 'chat-input', 'modal-choice', 'choice-title', 'choice-list',
  'modal-number', 'num-grid', 'num-cancel', 'modal-status', 'status-body', 'status-close', 'banner', 'banner-text',
  'modal-result', 'result-cols', 'ranking', 'btn-rematch', 'btn-exit', 'modal-rules', 'rules-close', 'toasts',
] as const;
export type DomId = (typeof DOM_IDS)[number];

export interface Shell {
  show(screen: ScreenId): void;
  current(): ScreenId;
  el<T extends HTMLElement = HTMLElement>(id: DomId): T;
  setHidden(id: DomId, hidden: boolean): void;
  isHidden(id: DomId): boolean;
  onShow(fn: (screen: ScreenId) => void): void;
}

export function initShell(doc: Document): Shell {
  const els = new Map<DomId, HTMLElement>();
  for (const id of DOM_IDS) {
    const e = doc.getElementById(id);
    if (!e) throw new Error(`missing #${id}`);
    els.set(id, e);
  }
  let cur: ScreenId = 'title';
  const listeners: ((s: ScreenId) => void)[] = [];
  const shell: Shell = {
    show(screen) {
      for (const s of doc.querySelectorAll('.screen')) s.classList.toggle('active', s.id === `screen-${screen}`);
      cur = screen;
      for (const fn of listeners) fn(screen);
    },
    current: () => cur,
    el: <T extends HTMLElement = HTMLElement>(id: DomId) => els.get(id) as T,
    setHidden: (id, hidden) => { els.get(id)!.classList.toggle('hidden', hidden); },
    isHidden: (id) => els.get(id)!.classList.contains('hidden'),
    onShow: (fn) => { listeners.push(fn); },
  };
  return shell;
}
