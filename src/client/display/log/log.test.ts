/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/display/log/log.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/log/log.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { fakeCtx } from '../../testkit';
import { createLog } from './log';

const submit = (ctx: ReturnType<typeof fakeCtx>, v: string) => {
  ctx.shell.el<HTMLInputElement>('chat-input').value = v;
  ctx.shell.el('chat-form').dispatchEvent(new Event('submit', { cancelable: true }));
};

describe('log', () => {
  it('1: 150줄', () => {
    const ctx = fakeCtx(); const log = createLog(ctx);
    for (let i = 0; i < 151; i++) log.add(`l${i}`);
    const list = ctx.shell.el('log-list');
    expect(list.children.length).toBe(150);
    expect(list.firstElementChild!.innerHTML).toBe('l1');
  });
  it('2: 열기', () => { const log = createLog(fakeCtx()); log.toggle(); expect(log.isOpen()).toBe(true); });
  it('3: 채팅', () => {
    const ctx = fakeCtx(); createLog(ctx);
    submit(ctx, '안녕 ');
    expect(ctx.sent).toEqual([{ type: 'chat', text: '안녕' }]);
    expect(ctx.shell.el<HTMLInputElement>('chat-input').value).toBe('');
  });
  it('4: 공백', () => { const ctx = fakeCtx(); createLog(ctx); submit(ctx, '  '); expect(ctx.sent).toEqual([]); });
});
