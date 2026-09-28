/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/controls/choice/choice.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/choice/choice.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChoicePending } from '../../../engine/engine';
import { fakeCtx, sampleState } from '../../testkit';
import { initChoice, promptText } from './choice';

const choice = (n: number, disabled: number[] = []): ChoicePending => ({
  type: 'choice', kind: 'event', playerId: 'p0', title: '고르세요',
  options: Array.from({ length: n }, (_, i) => ({ label: `o${i}`, disabled: disabled.includes(i) })),
});

describe('choice', () => {
  it('1·2: 선택 창과 선택', () => {
    const ctx = fakeCtx(); const send = vi.fn();
    const c = initChoice(ctx, send);
    c.update(choice(3, [1]));
    expect(ctx.shell.isHidden('modal-choice')).toBe(false);
    const btns = ctx.shell.el('choice-list').querySelectorAll('button');
    expect(btns.length).toBe(3);
    expect((btns[1] as HTMLButtonElement).disabled).toBe(true);
    (btns[2] as HTMLButtonElement).click();
    expect(send).toHaveBeenCalledWith({ type: 'choose', index: 2 });
    expect(ctx.shell.isHidden('modal-choice')).toBe(true);
  });
  it('3: 남의 룰렛 대기', () => {
    const ctx = fakeCtx();
    const s = sampleState(); s.players[0].name = '민수';
    ctx.store.set({ me: 'p1', state: s });
    expect(promptText(ctx.store)).toEqual({ text: '민수 룰렛 대기 중...', wait: true });
  });
  it('4: 두 줄 격자', () => {
    const ctx = fakeCtx();
    initChoice(ctx, vi.fn()).update(choice(17));
    expect(ctx.shell.el('choice-list').classList.contains('grid2')).toBe(true);
  });
  it('5: 재생 중', () => {
    const ctx = fakeCtx();
    ctx.store.set({ me: 'p1', state: sampleState(), busy: true });
    expect(promptText(ctx.store).text).toBe('');
  });
});
