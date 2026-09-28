/**
 * @pyramid-spec      design/engine/core/types/types.md
 * @pyramid-parent    design/engine/core/core.md
 * @pyramid-on-change 1) design/engine/core/types/types.md 먼저 수정 2) 이 코드 수정 3) design/engine/core/core.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { RuleError } from './types';

describe('types', () => {
  it('1: RuleError', () => {
    const e = new RuleError('x');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(RuleError);
    expect(e.message).toBe('x');
    expect(e.name).toBe('RuleError');
  });
  it('2: catch 로 구분', () => {
    try { throw new RuleError('y'); } catch (e) { expect(e instanceof RuleError).toBe(true); }
  });
  it('3: 타입 컴파일은 tsc --noEmit 로 검사', () => { expect(true).toBe(true); });
});
