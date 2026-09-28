/**
 * @pyramid-spec      design/view/actors/pieces/pieces.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/pieces/pieces.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { slotPos } from './pieces';

describe('pieces', () => {
  it('1: 자리 0·3', () => {
    expect(slotPos({ x: 0, z: 0 }, 0, 0)).toEqual({ x: -0.65, z: -0.55 });
    const p = slotPos({ x: 0, z: 0 }, 0, 3);
    expect(p.x).toBeCloseTo(0.65); expect(p.z).toBeCloseTo(0.6);
  });
  it('2: 회전', () => {
    const p = slotPos({ x: 0, z: 0 }, Math.PI / 2, 0);
    expect(p.x).toBeCloseTo(-0.55, 9); expect(p.z).toBeCloseTo(0.65, 9);
  });
  it('3: 순환', () => { expect(slotPos({ x: 1, z: 2 }, 0.3, 5)).toEqual(slotPos({ x: 1, z: 2 }, 0.3, 1)); });
});
