/**
 * @pyramid-spec      design/client/client.md
 * @pyramid-parent    design/capstone.md
 * @pyramid-on-change 1) design/client/client.md 먼저 수정 2) 이 코드 수정 3) design/capstone.md 「통합 방식」 영향 검토
 */
// 클라이언트 테스트 공용 도구 (테스트에서만 import): 실제 index.html 로 jsdom 문서를 만들고 가짜 ctx 를 조립한다.
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { AVATAR_DEFAULT } from '../data/data';
import { createGame, publicState, type PublicState } from '../engine/engine';
import { initShell } from './shell/shell';
import { createStore } from './store/store';
import type { ClientCtx } from './ctx';

export function loadDom(): void {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^<!DOCTYPE html>/i, '');
}

export function sampleState(n = 2, seed = 1): PublicState {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false }));
  return publicState(createGame({ players, seed }).state);
}

export function fakeView() {
  return {
    syncPieces: vi.fn(), hopPath: vi.fn(async (_p: string, path: number[], _i: number, onStep?: (t: number) => void) => { path.forEach((t) => onStep?.(t)); }),
    warp: vi.fn(async () => {}), focus: vi.fn(), focusTile: vi.fn(), overview: vi.fn(), zoomDefault: vi.fn(), setActiveTile: vi.fn(),
    confettiAt: vi.fn(), flash: vi.fn(), project: vi.fn(() => ({ x: 10, y: 20 })),
    roulette: { charge: vi.fn(), release: vi.fn(), spinTo: vi.fn(async () => {}) },
  };
}

export function fakeCtx(over: Partial<ClientCtx> = {}): ClientCtx & { sent: unknown[] } {
  loadDom();
  const sent: unknown[] = [];
  const shell = initShell(document);
  const store = createStore();
  const connection = { connect: vi.fn(), send: vi.fn((m: unknown) => { sent.push(m); }), saveSession: vi.fn(), clearSession: vi.fn(), loadSession: vi.fn(() => null) };
  const ctx = {
    doc: document, shell, store, connection,
    display: {} as ClientCtx['display'], lobby: {} as ClientCtx['lobby'], controls: { updateControls: vi.fn() },
    getView: () => null, ensureView: async () => fakeView() as unknown as ReturnType<ClientCtx['getView']> & object,
    sent, ...over,
  } as unknown as ClientCtx & { sent: unknown[] };
  return ctx;
}
