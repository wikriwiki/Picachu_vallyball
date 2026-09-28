/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/controls/menu/menu.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/menu/menu.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { fakeCtx, fakeView } from '../../testkit';
import { initMenu } from './menu';

function setup() {
  const view = fakeView();
  const ctx = fakeCtx({ getView: () => view as never });
  let muted = false;
  (ctx as unknown as { display: unknown }).display = {
    openStatus: vi.fn(), toggleLog: vi.fn(),
    sound: { get muted() { return muted; }, toggle: () => (muted = !muted) },
  };
  initMenu(ctx);
  return { ctx, view };
}

describe('menu', () => {
  it('1: 카드', () => {
    const { ctx } = setup();
    ctx.shell.setHidden('hand', true);
    ctx.shell.el('cmd-card').click();
    expect(ctx.shell.isHidden('hand')).toBe(false);
    expect(ctx.shell.el('cmd-card').classList.contains('on')).toBe(true);
    ctx.shell.el('cmd-card').click();
    expect(ctx.shell.isHidden('hand')).toBe(true);
    expect(ctx.shell.el('cmd-card').classList.contains('on')).toBe(false);
  });
  it('2: 전체 지도', () => {
    const { ctx, view } = setup();
    ctx.shell.el('btn-view').click(); ctx.shell.el('btn-view').click();
    expect(view.overview).toHaveBeenCalledTimes(1);
    expect(view.zoomDefault).toHaveBeenCalledTimes(1);
  });
  it('3: 소리', () => {
    const { ctx } = setup();
    ctx.shell.el('btn-mute').click();
    expect(ctx.shell.el('btn-mute').textContent).toBe('🔇');
  });
  it('4: 규칙', () => {
    const { ctx } = setup();
    ctx.shell.el('btn-rules').click(); expect(ctx.shell.isHidden('modal-rules')).toBe(false);
    ctx.shell.el('rules-close').click(); expect(ctx.shell.isHidden('modal-rules')).toBe(true);
  });
});
