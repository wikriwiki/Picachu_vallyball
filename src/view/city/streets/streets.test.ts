/**
 * @pyramid-spec      design/view/city/streets/streets.md
 * @pyramid-parent    design/view/city/city.md
 * @pyramid-on-change 1) design/view/city/streets/streets.md 먼저 수정 2) 이 코드 수정 3) design/view/city/city.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { ALLEYS, lampSpots, makeRoadDist } from './streets';

describe('streets', () => {
  const rd = makeRoadDist([-10.5, 10.5], 38, -10.5, 10.5);
  it('1: 가로 도로 위', () => { expect(rd(0, 10.5)).toBe(0); });
  it('2: 가장자리 도로', () => { expect(rd(38, 0)).toBe(0); });
  it('3: 골목까지', () => { expect(rd(5, 0)).toBe(5); });
  it('4: 가로등 자리', () => {
    const spots = lampSpots([10.5], 38, 60);
    expect(spots.length).toBeGreaterThan(0);
    for (const [x, z] of spots) {
      expect(Math.abs(Math.abs(x) - 30)).toBeGreaterThanOrEqual(3);
      expect(ALLEYS.every((a) => Math.abs(x - a) >= 3)).toBe(true);
      expect(Math.abs(Math.abs(z - 10.5) - 2.1)).toBeLessThan(1e-9);
    }
    expect(spots[0][1]).toBeCloseTo(10.5 - 2.1);
    expect(spots[1][1]).toBeCloseTo(10.5 + 2.1);
  });
});
