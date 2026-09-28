/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/display/result/result.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/result/result.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { fakeCtx, sampleState } from '../../testkit';
import { createSound } from '../sound/sound';
import { createResult } from './result';

const ended = () => {
  const s = sampleState();
  s.phase = 'ended';
  s.result = {
    rows: [
      { pid: 'p0', items: [{ label: '현금', amount: 1000 }, { label: '약속어음 2장 상환', amount: -2400 }], total: -1400 },
      { pid: 'p1', items: [{ label: '현금', amount: 500 }, { label: 'a', amount: 1 }, { label: 'b', amount: 1 }], total: 502 },
    ],
    ranking: ['p1', 'p0'],
  };
  return s;
};

describe('result', () => {
  it('1: 한 줄씩 공개', async () => {
    const ctx = fakeCtx(); const sleep = vi.fn(async () => {});
    await createResult(ctx, createSound({ storage: { getItem: () => null, setItem: () => {} } }), { sleep }).show(ended());
    expect(sleep).toHaveBeenCalledTimes(3);
    const cols = ctx.shell.el('result-cols').querySelectorAll('.rcol');
    expect(cols[0].querySelectorAll('.it').length).toBe(2);
    expect(cols[1].querySelectorAll('.it').length).toBe(3);
    expect(cols[1].querySelector('.tot')!.textContent).toBe('502만원');
  });
  it('2: 방장 아님', async () => {
    const ctx = fakeCtx();
    await createResult(ctx, createSound({ storage: { getItem: () => null, setItem: () => {} } }), { sleep: async () => {} }).show(ended());
    expect(ctx.shell.isHidden('btn-rematch')).toBe(true);
  });
  it('3: 음수 항목', async () => {
    const ctx = fakeCtx();
    await createResult(ctx, createSound({ storage: { getItem: () => null, setItem: () => {} } }), { sleep: async () => {} }).show(ended());
    expect(ctx.shell.el('result-cols').querySelector('.a.neg')!.textContent).toBe('-2,400만원');
  });
  it('4: 순위', async () => {
    const ctx = fakeCtx();
    await createResult(ctx, createSound({ storage: { getItem: () => null, setItem: () => {} } }), { sleep: async () => {} }).show(ended());
    const first = ctx.shell.el('ranking').querySelector('.rank.first')!;
    expect(first.textContent).toContain('👑');
    expect(first.textContent).toContain('P1');
  });
  it('5: 나가기', () => {
    const ctx = fakeCtx(); const assign = vi.fn();
    createResult(ctx, createSound({ storage: { getItem: () => null, setItem: () => {} } }), { location: { pathname: '/x', assign } });
    ctx.shell.el('btn-exit').click();
    expect(ctx.sent).toEqual([{ type: 'leave' }]);
    expect(ctx.connection.clearSession).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/x');
  });
});
