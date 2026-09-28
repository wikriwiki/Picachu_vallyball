/**
 * @pyramid-spec      design/data/tables/tables.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/tables/tables.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { CARD_POOL, ERAS, JOBS, gradeIndex, gradeOf, jobById, meetsReq } from './tables';

const pl = (stats: Partial<Record<'int' | 'phy' | 'sen', number>>, fortune = 3) => ({ stats: { int: 0, phy: 0, sen: 0, ...stats }, fortune });

describe('tables', () => {
  it('1: 등급', () => {
    expect([gradeOf(44), gradeOf(45), gradeOf(90)]).toEqual(['D', 'C', 'S']);
    expect([gradeIndex(0), gradeIndex(9), gradeIndex(10), gradeIndex(100)]).toEqual([0, 0, 1, 7]);
  });
  it('2: 직업 17종과 랭크 수', () => {
    expect(JOBS.length).toBe(17);
    for (const j of JOBS) expect(j.ranks.length).toBe(j.id === 'freelancer' ? 1 : 5);
  });
  it('3: 회장 운세 조건', () => {
    const office = jobById('office')!;
    expect(meetsReq(pl({ int: 75, sen: 60 }, 4), office.ranks[4])).toBe(false);
    expect(meetsReq(pl({ int: 75, sen: 60 }, 5), office.ranks[4])).toBe(true);
  });
  it('4: 1랭크 조건', () => {
    const office = jobById('office')!;
    expect(meetsReq(pl({ int: 20 }), office.ranks[0])).toBe(true);
    expect(meetsReq(pl({ int: 19 }), office.ranks[0])).toBe(false);
  });
  it('5: 카드 주머니', () => {
    expect(CARD_POOL.filter((c) => c === 'fixed').length).toBe(2);
    expect(CARD_POOL.filter((c) => c === 'insurance').length).toBe(2);
    expect(CARD_POOL.length).toBe(12);
  });
  it('6: 시대 턴 수', () => {
    expect(ERAS.map((e) => e.turns)).toEqual([2, 4, 4, 4, 15, 15, null]);
  });
  it('7: 프리랜서는 조건 없음', () => {
    expect(meetsReq(pl({}), jobById('freelancer')!.ranks[0])).toBe(true);
  });
});
