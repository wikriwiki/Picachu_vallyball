/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/controls/spin/spin.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/spin/spin.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { fakeCtx, fakeView, sampleState } from '../../testkit';
import { initSpin, powerAt } from './spin';

function setup(myTurn = true) {
  const view = fakeView();
  const ctx = fakeCtx({ getView: () => view as never });
  (ctx as unknown as { display: unknown }).display = { sound: { unlock: vi.fn() } };
  const s = sampleState();
  ctx.store.set({ me: myTurn ? s.pending!.playerId : 'nobody', state: s });
  let t = 0;
  const send = vi.fn();
  const spin = initSpin(ctx, send, { now: () => t, raf: () => {} });
  return { ctx, send, spin, view, setT: (v: number) => { t = v; }, s };
}
const ev = (type: string) => new Event(type, { cancelable: true });

describe('spin', () => {
  it('1: 파워', () => { expect(powerAt(0)).toBe(0); expect(powerAt(Math.PI / 3.2)).toBeCloseTo(1); });
  it('2: 룰렛 대기면 켜짐', () => {
    const { ctx, spin, s } = setup();
    spin.update(s.pending);
    expect(ctx.shell.el<HTMLButtonElement>('btn-spin').disabled).toBe(false);
  });
  it('3: 선택 대기면 꺼짐', () => {
    const { ctx, spin } = setup();
    spin.update({ type: 'choice', kind: 'event', playerId: 'p0', title: '', options: [] });
    expect(ctx.shell.el<HTMLButtonElement>('btn-spin').disabled).toBe(true);
  });
  it('4: 누르고 떼기', () => {
    const { ctx, send, view, setT } = setup();
    ctx.shell.el('btn-spin').dispatchEvent(ev('pointerdown'));
    setT(490);
    ctx.shell.el('btn-spin').dispatchEvent(ev('pointerup'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].power).toBeCloseTo(powerAt(0.49));
    expect(view.roulette.release).toHaveBeenCalled();
  });
  it('5: 대기 없음', () => {
    const { ctx, send } = setup(false);
    ctx.shell.el('btn-spin').dispatchEvent(ev('pointerdown'));
    ctx.shell.el('btn-spin').dispatchEvent(ev('pointerup'));
    expect(send).not.toHaveBeenCalled();
  });
  it('6: 입력칸 초점', () => {
    const { ctx, send } = setup();
    ctx.shell.el<HTMLInputElement>('chat-input').focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(send).not.toHaveBeenCalled();
  });
});
