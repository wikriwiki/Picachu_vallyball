/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/display/notice/notice.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/notice/notice.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { fakeCtx, fakeView, sampleState } from '../../testkit';
import { createNotice, esc } from './notice';

const timers = () => { const list: (() => void)[] = []; return { list, setTimeout: (fn: () => void) => { list.push(fn); } }; };

describe('notice', () => {
  it('1: esc', () => { expect(esc(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;'); });
  it('2: 메시지', () => {
    const ctx = fakeCtx();
    const s = sampleState(); s.players[1].name = '민수';
    ctx.store.set({ shown: s });
    createNotice(ctx).message('안녕', 'lucky', 'p1');
    expect(ctx.shell.el('msg-name').textContent).toBe('민수');
    expect(ctx.shell.el('msgbox').className).toBe('msgbox lucky');
  });
  it('3: 떠오르는 글자', () => {
    const t = timers();
    const ctx = fakeCtx({ getView: () => fakeView() as never });
    createNotice(ctx, t).floater('p0', '+1', 'plus');
    expect(ctx.shell.el('floaters').children.length).toBe(1);
    t.list[0]();
    expect(ctx.shell.el('floaters').children.length).toBe(0);
  });
  it('4: view 없음', () => {
    const ctx = fakeCtx();
    createNotice(ctx).floater('p0', '+1', 'plus');
    expect(ctx.shell.el('floaters').children.length).toBe(0);
  });
  it('5: 배너', async () => {
    const t = timers();
    const ctx = fakeCtx();
    const p = createNotice(ctx, t).banner('x', 900);
    expect(ctx.shell.isHidden('banner')).toBe(false);
    t.list[0]();
    await p;
    expect(ctx.shell.isHidden('banner')).toBe(true);
  });
  it('6: 토스트', () => {
    const t = timers();
    const ctx = fakeCtx();
    createNotice(ctx, t).toast('오류', true);
    expect(ctx.shell.el('toasts').querySelector('.toast.err')).not.toBeNull();
    t.list[0]();
    expect(ctx.shell.el('toasts').children.length).toBe(0);
  });
});
