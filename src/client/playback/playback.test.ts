/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/playback/playback.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/playback/playback.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import type { GameEvent, PublicState } from '../../engine/engine';
import { fakeCtx, fakeView, sampleState } from '../testkit';
import { createPlayback } from './playback';

function setup(me = 'p1') {
  const view = fakeView();
  const ctx = fakeCtx({ ensureView: async () => view as never });
  const display = {
    renderHud: vi.fn(), message: vi.fn(), floater: vi.fn(), banner: vi.fn(async () => {}), addLog: vi.fn(), showResult: vi.fn(async () => {}),
    sound: new Proxy({}, { get: () => vi.fn() }),
  };
  (ctx as unknown as { display: unknown }).display = display;
  ctx.store.set({ me });
  const sleeps: number[] = [];
  const pb = createPlayback(ctx, { sleep: async (ms) => { sleeps.push(ms); } });
  const idle = async () => { for (let i = 0; i < 50 && (ctx.store.get('busy') || ctx.store.get('queued')); i++) await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
  return { ctx, view, display, pb, sleeps, idle };
}
const E = (e: object) => e as GameEvent;

describe('playback', () => {
  it('1: 첫 상태', async () => {
    const { ctx, view, pb, idle } = setup();
    const s1 = sampleState();
    pb.enqueue(s1, []);
    await idle();
    expect(ctx.shell.current()).toBe('game');
    expect(view.syncPieces).toHaveBeenCalledWith(s1, false);
    expect(ctx.store.get('state')).toBe(s1);
    expect(ctx.store.get('busy')).toBe(false);
    expect(ctx.controls.updateControls).toHaveBeenCalledTimes(1);
  });
  it('2: 돈 이벤트', async () => {
    const { ctx, display, pb, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    const s2 = structuredClone(s1);
    pb.enqueue(s2, [E({ t: 'money', pid: 'p0', delta: 100, reason: '' })]);
    await idle();
    const shown = display.renderHud.mock.calls.find((c) => (c[0] as PublicState).players[0].money === s1.players[0].money + 100);
    expect(shown).toBeTruthy();
    expect(display.floater).toHaveBeenCalledWith('p0', '+100만원', 'plus');
    expect(ctx.store.get('state')).toBe(s2);
  });
  it('3: 메시지', async () => {
    const { display, pb, sleeps, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    pb.enqueue(structuredClone(s1), [E({ t: 'msg', pid: 'p0', text: '와', kind: 'lucky' })]);
    await idle();
    expect(display.message).toHaveBeenCalledWith('와', 'lucky', 'p0');
    expect(display.addLog).toHaveBeenCalledTimes(1);
    expect(sleeps).toContain(1150);
  });
  it('4: 밀리면 빠르게', async () => {
    const { pb, sleeps, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    for (let i = 0; i < 5; i++) pb.enqueue(structuredClone(s1), [E({ t: 'msg', pid: 'p0', text: 'x', kind: 'info' })]);
    await idle();
    expect(sleeps[0]).toBeCloseTo(1150 * 0.3);
  });
  it('5: 카드 사용', async () => {
    const { display, pb, idle } = setup();
    const s1 = sampleState(); s1.players[0].cards = ['double', 'fixed'];
    pb.enqueue(s1, []); await idle();
    pb.enqueue(structuredClone(s1), [E({ t: 'card', pid: 'p0', card: 'double', used: true })]);
    await idle();
    const last = display.renderHud.mock.calls.at(-2)![0] as PublicState;
    expect(last.players[0].cards).toEqual(['fixed']);
    expect(display.message).toHaveBeenCalledWith('더블 카드 사용!', 'lucky', 'p0');
  });
  it('6: 결과 한 번', async () => {
    const { display, pb, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    const s2 = { ...structuredClone(s1), phase: 'ended' as const };
    pb.enqueue(s2, [E({ t: 'result', result: {} })]); await idle();
    pb.enqueue(structuredClone(s2), []); await idle();
    expect(display.showResult).toHaveBeenCalledTimes(1);
  });
  it('7: 이동', async () => {
    const { ctx, view, pb, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    pb.enqueue(structuredClone(s1), [E({ t: 'move', pid: 'p0', path: [5, 6, 7] })]);
    await idle();
    expect(view.hopPath).toHaveBeenCalled();
    expect(ctx.store.get('shown')!.players[0].tile).toBe(7);
  });
  it('8: 예외가 나도 계속', async () => {
    const { ctx, view, pb, idle } = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    view.hopPath.mockRejectedValueOnce(new Error('x'));
    pb.enqueue(structuredClone(s1), [E({ t: 'move', pid: 'p0', path: [1] })]);
    const s3 = structuredClone(s1);
    pb.enqueue(s3, []);
    await idle();
    expect(err).toHaveBeenCalledTimes(1);
    expect(ctx.store.get('state')).toBe(s3);
    expect(ctx.store.get('busy')).toBe(false);
  });
  it('9: reset', async () => {
    const { ctx, pb, idle } = setup();
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    const s2 = structuredClone(s1); const s3 = structuredClone(s1);
    pb.enqueue(s2, []); pb.enqueue(s3, []);
    pb.reset();
    await idle();
    expect(ctx.store.get('queued')).toBe(0);
    expect(ctx.store.get('state')).toBe(s1);
  });
  it('10: 남의 선택', async () => {
    const { display, pb, sleeps, idle } = setup('p1');
    const s1 = sampleState(); pb.enqueue(s1, []); await idle();
    pb.enqueue(structuredClone(s1), [E({ t: 'chose', pid: 'p0', kind: 'career', index: 0, label: '대학 진학' })]);
    await idle();
    expect(display.message).toHaveBeenCalledWith('「대학 진학」 을(를) 골랐다.', 'info', 'p0');
    expect(sleeps).toContain(900);
  });
});
