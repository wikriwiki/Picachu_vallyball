/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/display/status/status.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/status/status.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { fakeCtx, sampleState } from '../../testkit';
import { createStatus, statusCardHtml } from './status';

describe('status', () => {
  const s = sampleState();
  it('1: 직업·능력치', () => {
    const p = structuredClone(s.players[0]); p.job = 'teacher'; p.stats.int = 30;
    const h = statusCardHtml(s, p);
    expect(h).toContain('📚 교사 · 교생 (월급 500만원)');
    expect(h).toContain('지력 <b>D</b> (30)');
  });
  it('2: 호감도 막대', () => {
    const p = structuredClone(s.players[0]); p.partner = { id: s.partners[0].id, affinity: 45 };
    expect(statusCardHtml(s, p)).toContain('width:45%');
  });
  it('3: 이스케이프', () => {
    const p = structuredClone(s.players[0]); p.name = '<i>';
    expect(statusCardHtml(s, p)).toContain('&lt;i&gt;');
  });
  it('4: 열기', () => {
    const ctx = fakeCtx();
    ctx.store.set({ state: s });
    createStatus(ctx).open();
    expect(ctx.shell.isHidden('modal-status')).toBe(false);
    expect(ctx.shell.el('status-body').querySelectorAll('.status-card').length).toBe(2);
  });
});
