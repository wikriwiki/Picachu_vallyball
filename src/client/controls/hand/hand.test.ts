/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/controls/hand/hand.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/hand/hand.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import type { Pending } from '../../../engine/engine';
import { fakeCtx, sampleState } from '../../testkit';
import { canUseCard, initHand } from './hand';

const move: Pending = { type: 'spin', playerId: 'p0', purpose: 'move', title: '' };

describe('hand', () => {
  const me = () => structuredClone(sampleState().players[0]);
  it('1: 사용 가능', () => { expect(canUseCard(me(), move, 'double')).toBe(true); expect(canUseCard(me(), move, 'insurance')).toBe(false); });
  it('2: 승진 카드', () => { expect(canUseCard(me(), move, 'rankup')).toBe(false); });
  it('3: 선택 대기', () => { expect(canUseCard(me(), { type: 'choice', kind: 'event', playerId: 'p0', title: '', options: [] }, 'charm')).toBe(false); });
  it('4·5: 카드 누르기와 숫자 고르기', () => {
    const ctx = fakeCtx(); const send = vi.fn();
    const s = sampleState();
    s.players[0].cards = ['charm', 'fixed'];
    ctx.store.set({ me: 'p0', state: s });
    const h = initHand(ctx, send);
    h.update(move);
    const cards = ctx.shell.el('hand').querySelectorAll('.card');
    (cards[0] as HTMLElement).click();
    expect(send).toHaveBeenLastCalledWith({ type: 'card', index: 0 });
    (cards[1] as HTMLElement).click();
    expect(ctx.shell.isHidden('modal-number')).toBe(false);
    (ctx.shell.el('num-grid').children[6] as HTMLElement).click();
    expect(send).toHaveBeenLastCalledWith({ type: 'card', index: 1, number: 7 });
    expect(ctx.shell.isHidden('modal-number')).toBe(true);
  });
});
