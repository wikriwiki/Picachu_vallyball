// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 엔진 시뮬레이션 테스트: CPU끼리 여러 시드로 끝까지 플레이
import assert from 'node:assert/strict';
import { createGame, applyAction, cpuAction, publicState } from '../shared/engine.js';
import { BOARD } from '../shared/board.js';
import { ERAS } from '../shared/data.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

assert.equal(BOARD.tiles.length, ERAS.reduce((s, e) => s + e.len, 0));
assert.equal(BOARD.tiles.filter((t) => t.type === 'goal').length, 1);

let totalActions = 0;
const stats = { married: 0, kids: 0, houses: 0, notes: 0, jobs: {} };
for (const mode of ['full', 'adult', 'kids']) {
  for (let seed = 1; seed <= 60; seed++) {
    const n = 1 + (seed % 4);
    const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, cpu: true }));
    const s = createGame({ players, mode, seed });
    const rand = mulberry(seed * 7);
    let steps = 0;
    while (s.phase === 'playing') {
      assert.ok(s.pending, 'pending must exist while playing');
      const a = cpuAction(s, rand);
      assert.ok(a, 'cpu action');
      applyAction(s, s.pending ? s.pending.playerId : null, a);
      JSON.stringify(publicState(s));
      if (++steps > 5000) throw new Error('game did not end: ' + mode + ' seed ' + seed);
    }
    totalActions += steps;
    assert.equal(s.phase, 'ended');
    assert.ok(s.result && s.result.ranking.length === n);
    for (const p of s.players) {
      assert.ok(p.money >= 0, 'money never negative');
      if (mode !== 'kids') {
        assert.ok(p.finished, 'all finished');
        assert.ok(p.job, 'has job');
        stats.jobs[p.job] = (stats.jobs[p.job] || 0) + 1;
      }
      if (p.spouse) stats.married++;
      stats.kids += p.kids.length;
      stats.houses += p.houses.length;
      stats.notes += p.notes;
    }
  }
}

// 잘못된 차례 거부
{
  const s = createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed: 5 });
  assert.throws(() => applyAction(s, 'b', { type: 'spin', power: 0.5 }));
  applyAction(s, 'a', { type: 'spin', power: 0.5 });
}
// docs/ADR.md §12.2 칸 구성표와 일치하는지 (ADR 과 코드의 일관성 보장)
{
  const expected = {
    baby: { start: 1, star1: 6, star2: 2, star3: 1, hiyari: 1, choice: 1, card: 1, end: 1 },
    elem: { start: 1, star1: 10, star2: 4, star3: 1, hiyari: 3, ghost: 1, choice: 3, card: 1, payday: 3, end: 1 },
    middle: { start: 1, star1: 10, star2: 4, star3: 1, hiyari: 3, ghost: 1, choice: 3, card: 1, payday: 3, end: 1 },
    high: { start: 1, star1: 8, star2: 4, star3: 1, hiyari: 3, ghost: 1, love: 3, choice: 2, card: 1, payday: 3, end: 1 },
    adult1: { start: 1, star1: 8, star2: 5, star3: 2, hiyari: 3, ghost: 2, love: 3, choice: 3, card: 2, challenge: 5, baby: 2, payday: 8, 'stop:marriage': 1, end: 1 },
    adult2: { start: 1, star1: 8, star2: 5, star3: 2, hiyari: 3, ghost: 3, love: 2, choice: 3, card: 1, challenge: 5, baby: 3, payday: 8, 'stop:house': 1, end: 1 },
    final: { start: 1, star1: 8, star2: 4, star3: 2, hiyari: 3, ghost: 3, love: 1, choice: 3, card: 1, payday: 5, goal: 1 },
  };
  ERAS.forEach((e, i) => {
    const c = {};
    BOARD.tiles.filter((t) => t.era === i).forEach((t) => { const k = t.type + (t.stop ? ':' + t.stop : ''); c[k] = (c[k] || 0) + 1; });
    assert.deepEqual(c, expected[e.id], 'ADR §12.2 mismatch: ' + e.id);
    const ts = BOARD.tiles.filter((t) => t.era === i);
    for (let k = 1; k < ts.length; k++) assert.ok(!(ts[k].type === ts[k - 1].type && ts[k].type !== 'star1'), 'no repeats');
  });
}

// 물방울 칸: 능력치 변동 룰렛 (ADR §6.6) / 유령 칸: 보험으로 무효 (ADR §6.7)
{
  const hi = BOARD.tiles.find((t) => t.type === 'hiyari' && t.era === 1);
  const s = createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed: 9 });
  s.era = 1; s.players[0].tile = hi.i - 1;
  s.players[0].cards = ['fixed'];
  applyAction(s, 'a', { type: 'card', index: 0, number: 1 });
  applyAction(s, 'a', { type: 'spin', power: 0 });
  assert.equal(s.pending.purpose, 'hiyari');
  const stat = s.pending.stat;
  const before = s.players[0].stats[stat];
  const ev = applyAction(s, 'a', { type: 'spin', power: 0 });
  const v = ev.find((e) => e.t === 'spin').value;
  const d = [-12, -10, -8, -6, -5, -4, -3, -2, 3, 6][v - 1];
  assert.equal(s.players[0].stats[stat], Math.max(0, Math.min(100, before + d)));

  const gh = BOARD.tiles.find((t) => t.type === 'ghost' && t.era === 1);
  const s2 = createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seed: 3 });
  s2.era = 1; s2.players[0].tile = gh.i - 1; s2.players[0].cards = ['fixed', 'insurance']; s2.players[0].insurance = 1;
  const f0 = s2.players[0].fortune;
  applyAction(s2, 'a', { type: 'card', index: 0, number: 1 });
  applyAction(s2, 'a', { type: 'spin', power: 0 });
  assert.equal(s2.players[0].insurance, 0);
  assert.equal(s2.players[0].fortune, f0, '보험이 유령 칸을 막음');
}

console.log('engine ok — actions:', totalActions, JSON.stringify(stats));
