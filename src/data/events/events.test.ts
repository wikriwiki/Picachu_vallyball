/**
 * @pyramid-spec      design/data/events/events.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/events/events.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { CHOICES, EVENTS, GHOST, HIYARI, HIYARI_SPIN, LOVE, STAR3 } from './events';

describe('events', () => {
  it('1: 표별 항목 수', () => {
    expect([EVENTS.baby, EVENTS.elem, EVENTS.middle, EVENTS.high, EVENTS.adult, EVENTS.final].map((x) => x.length)).toEqual([9, 9, 9, 9, 12, 8]);
    expect([STAR3.kid.length, STAR3.adult.length]).toEqual([4, 5]);
    expect([HIYARI.baby, HIYARI.kid, HIYARI.adult, HIYARI.final].map((x) => x.length)).toEqual([2, 4, 4, 2]);
    expect([GHOST.baby, GHOST.kid, GHOST.adult, GHOST.final].map((x) => x.length)).toEqual([2, 5, 6, 3]);
    expect(LOVE.married.length).toBe(3);
    expect([CHOICES.kid, CHOICES.teen, CHOICES.adult, CHOICES.final].map((x) => x.length)).toEqual([2, 2, 3, 1]);
  });
  it('2: 물방울 룰렛표', () => {
    expect(HIYARI_SPIN.length).toBe(10);
    expect(HIYARI_SPIN.reduce((a, b) => a + b, 0)).toBe(-41);
  });
  it('3: 성과급', () => { expect(EVENTS.adult[3].e.money).toBe('salary'); });
  it('4: 창업 투자', () => { expect(CHOICES.adult[2].o[0].e.gamble).toBe(2000); });
});
