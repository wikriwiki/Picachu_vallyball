/**
 * @pyramid-spec      design/data/helpers/helpers.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/helpers/helpers.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { createRng, formatMoney, rngNext } from './helpers';

describe('helpers', () => {
  it('1: createRng 와 rngNext 수열이 같다', () => {
    const r = createRng(20231006);
    const a = Array.from({ length: 5 }, () => r());
    let s = 20231006;
    const b = Array.from({ length: 5 }, () => { const x = rngNext(s); s = x.seed; return x.value; });
    expect(a).toEqual(b);
  });
  it('2: seed 0 의 다음 시드', () => {
    expect(rngNext(0).seed).toBe(0x6d2b79f5);
  });
  it('3: 범위와 평균', () => {
    const r = createRng(1);
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 1000).toBeGreaterThan(0.4);
    expect(sum / 1000).toBeLessThan(0.6);
  });
  it('4: formatMoney 경계', () => {
    expect(formatMoney(0)).toBe('0만원');
    expect(formatMoney(10000)).toBe('1억원');
    expect(formatMoney(-1500)).toBe('-1,500만원');
    expect(formatMoney(12000)).toBe('1억 2,000만원');
    expect(formatMoney(0.4)).toBe('0만원');
  });
});
