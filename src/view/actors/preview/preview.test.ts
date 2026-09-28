/**
 * @pyramid-spec      design/view/actors/preview/preview.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/preview/preview.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { previewSway } from './preview';

describe('preview', () => {
  it('1', () => { expect(previewSway(0)).toBe(0); });
  it('2', () => { expect(previewSway(900 * Math.PI / 2)).toBeCloseTo(0.6); });
  it('3', () => { expect(previewSway(900 * Math.PI)).toBeCloseTo(0, 9); });
});
