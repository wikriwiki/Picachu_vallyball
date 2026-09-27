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
console.log('engine ok — actions:', totalActions, JSON.stringify(stats));
