/**
 * @pyramid-spec      design/view/roulette/roulette.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/roulette/roulette.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { segmentUnderPointer, stopAngle } from './roulette';

describe('roulette', () => {
  it('1: 멈춘 칸 = 값', () => {
    for (let v = 1; v <= 10; v++) expect(segmentUnderPointer(stopAngle(v, 0, 3, 0))).toBe(v - 1);
  });
  it('2: 흔들림이 있어도 같은 칸', () => {
    const j = 0.3 * (Math.PI * 2 / 10);
    for (let v = 1; v <= 10; v++) {
      expect(segmentUnderPointer(stopAngle(v, 0, 3, j * 0.99))).toBe(v - 1);
      expect(segmentUnderPointer(stopAngle(v, 0, 3, -j * 0.99))).toBe(v - 1);
    }
  });
  it('3: 최소 바퀴 수', () => { expect(stopAngle(5, 0, 3, 0)).toBeLessThanOrEqual(-3 * Math.PI * 2); });
});
