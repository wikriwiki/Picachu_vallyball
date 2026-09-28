/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/display/hud/hud.md
 * @pyramid-parent    design/client/display/display.md
 * @pyramid-on-change 1) design/client/display/hud/hud.md 먼저 수정 2) 이 코드 수정 3) design/client/display/display.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { BOARD } from '../../../data/data';
import { fakeCtx, sampleState } from '../../testkit';
import { createHud, jobLabel, partnerLabel, payLine, turnLine } from './hud';

describe('hud', () => {
  const s = sampleState();
  const p = () => structuredClone(s.players[0]);
  it('1: 직업', () => { const x = p(); x.job = 'office'; x.rank = 1; expect(jobLabel(x, 4)).toBe('💼 과장'); });
  it('2: 구직 중', () => { expect(jobLabel(p(), 5)).toBe('🧑 구직 중'); });
  it('3: 배우자', () => { const x = p(); x.spouse = '지우'; x.kids = ['a', 'b']; expect(partnerLabel(s, x)).toBe('💍 지우 👶×2'); });
  it('4: 상대', () => {
    const st = structuredClone(s);
    const c = st.partners.find((y) => y.id === 'harin')!; c.stars = 2;
    const x = p(); x.partner = { id: 'harin', affinity: 40 };
    expect(partnerLabel(st, x)).toBe('💗 하린 ★★ 40%');
  });
  it('5: 턴', () => { expect(turnLine({ ...s, era: 0, round: 5 })).toBe('턴 2/2'); });
  it('6: 용돈날', () => { const x = p(); x.tile = BOARD.eraStart[1]; expect(payLine({ ...s, era: 1 }, x)).toBe('용돈날까지 7칸'); });
  it('7: 여행 중', () => { const x = p(); x.tile = BOARD.subStart.countryside; expect(payLine(s, x)).toBe('✈️ 🌾 시골 마을 여행 중'); });
  it('8: 초점 플레이어', () => {
    const ctx = fakeCtx();
    const st = structuredClone(s);
    st.players[1].name = '민수';
    st.pending = { type: 'spin', playerId: 'p1', purpose: 'move', title: '' };
    createHud(ctx).render(st);
    expect(ctx.shell.el('hud-name').textContent).toBe('민수');
    const card = ctx.shell.el('players').children[1];
    expect(card.classList.contains('active')).toBe(true);
    expect(card.classList.contains('is-main')).toBe(true);
  });
});
