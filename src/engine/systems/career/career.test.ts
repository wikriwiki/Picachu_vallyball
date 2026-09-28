/**
 * @pyramid-spec      design/engine/systems/career/career.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/career/career.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../../data/data';
import { createContext, newGameState, type SpinPending } from '../../core/core';
import { makeJobChoice, onChallengeTile, promoteByStats, rankupNeed, resolveRankup } from './career';

const make = () => {
  const s = newGameState({ players: [{ id: 'a', name: 'A', avatar: { ...AVATAR_DEFAULT }, cpu: false }], seed: 3 });
  s.era = 4;
  return { s, c: createContext(s), p: s.players[0] };
};

describe('career', () => {
  it('1: 능력치 5면 프리랜서만', () => {
    const { c, p } = make();
    const ch = makeJobChoice(c, p);
    expect(ch.options.length).toBe(17);
    expect(ch.options.filter((o) => !o.disabled).map((o) => o.jobId)).toEqual(['freelancer']);
  });
  it('2: 지력 30', () => {
    const { c, p } = make();
    p.stats.int = 30;
    const on = makeJobChoice(c, p).options.filter((o) => !o.disabled).map((o) => o.jobId);
    expect(on).toContain('office');
    expect(on).toContain('teacher');
    expect(on).not.toContain('doctor');
  });
  it('3: 능력치 승진 여러 단계', () => {
    const { c, p } = make();
    p.job = 'office'; p.stats.int = 75; p.stats.sen = 60; p.fortune = 3;
    promoteByStats(c, p);
    expect(p.rank).toBe(3);
    expect(c.events.filter((e) => e.t === 'job').length).toBe(3);
  });
  it('4: 필요값 phy D', () => {
    const { p } = make();
    p.job = 'baseball'; p.stats.phy = 30;
    expect(rankupNeed(p)).toBe(7);
  });
  it('5: 필요값 phy S rank 1', () => {
    const { p } = make();
    p.job = 'baseball'; p.stats.phy = 90; p.rank = 1;
    expect(rankupNeed(p)).toBe(5);
  });
  it('6: 찬스 칸 룰렛 성공', () => {
    const { s, c, p } = make();
    p.job = 'baseball';
    onChallengeTile(c, p);
    resolveRankup(c, p, s.pending as SpinPending, 9);
    expect(p.rank).toBe(1);
  });
  it('7: 실패하면 핵심 능력치 +2', () => {
    const { c, p } = make();
    p.job = 'baseball'; p.stats.phy = 30;
    resolveRankup(c, p, { type: 'spin', playerId: 'a', purpose: 'rankup', need: 7, title: '' }, 3);
    expect(p.rank).toBe(0);
    expect(p.stats.phy).toBe(32);
  });
  it('8: 프리랜서 의뢰', () => {
    const { c, p } = make();
    p.job = 'freelancer';
    onChallengeTile(c, p);
    expect(p.money).toBe(1500);
  });
  it('9: 교사 승진 심사', () => {
    const { c, p } = make();
    p.job = 'teacher'; p.stats.int = 30;
    onChallengeTile(c, p);
    expect(p.stats.int).toBe(34);
  });
});
