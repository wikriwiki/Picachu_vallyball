/**
 * @pyramid-spec      design/engine/flow/finish/finish.md
 * @pyramid-parent    design/engine/flow/flow.md
 * @pyramid-on-change 1) design/engine/flow/finish/finish.md 먼저 수정 2) 이 코드 수정 3) design/engine/flow/flow.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT, TREASURE_MULT } from '../../../data/data';
import { createContext, newGameState } from '../../core/core';
import { finishGame } from './finish';

const make = (n: number) => {
  const s = newGameState({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: false })), seed: 2 });
  return { s, c: createContext(s) };
};
const labels = (s: ReturnType<typeof make>['s'], i: number) => s.result!.rows[i].items.map((x) => x.label);

describe('finish', () => {
  it('1: 항목과 대가족상', () => {
    const { s, c } = make(2);
    const [a, b] = s.players;
    a.money = 5000; a.notes = 2; b.money = 1000; b.kids = ['콩이'];
    finishGame(c);
    expect(s.result!.rows[0].items).toContainEqual({ label: '약속어음 2장 상환', amount: -2400 });
    expect(s.result!.rows[1].items).toContainEqual({ label: '자녀 1명의 효도 선물', amount: 1000 });
    expect(labels(s, 1)).toContain('특별상: 대가족상');
  });
  it('2: 2인 동점이면 시상 없음', () => {
    const { s, c } = make(2);
    s.players.forEach((p) => { p.stats.int = 30; });
    finishGame(c);
    expect(labels(s, 0)).not.toContain('특별상: 박사상 (지력 최고)');
  });
  it('3: 3인 중 2명 공동 수상', () => {
    const { s, c } = make(3);
    [30, 30, 10].forEach((v, i) => { s.players[i].stats.int = v; });
    finishGame(c);
    expect([0, 1, 2].filter((i) => labels(s, i).includes('특별상: 박사상 (지력 최고)')).length).toBe(2);
  });
  it('4: 보물 감정', () => {
    const { s, c } = make(1);
    s.players[0].treasures = [{ name: 'x', base: 1000 }];
    finishGame(c);
    const it0 = s.result!.rows[0].items.find((x) => x.label.startsWith('보물 감정'))!;
    expect(TREASURE_MULT.map((m) => Math.round(1000 * m))).toContain(it0.amount);
  });
  it('5: total 과 순위', () => {
    const { s, c } = make(3);
    s.players[0].money = 100; s.players[1].money = 9000; s.players[2].money = 4000;
    finishGame(c);
    for (const r of s.result!.rows) expect(r.total).toBe(r.items.reduce((a, b) => a + b.amount, 0));
    const totals = s.result!.ranking.map((pid) => s.result!.rows.find((r) => r.pid === pid)!.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });
  it('6: 상태', () => {
    const { s, c } = make(1);
    s.pending = { type: 'spin', playerId: 'p0', purpose: 'move', title: '' };
    finishGame(c);
    expect(s.phase).toBe('ended');
    expect(s.pending).toBeNull();
    expect(c.events.some((e) => e.t === 'result')).toBe(true);
  });
});
