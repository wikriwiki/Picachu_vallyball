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

// 그래프 구조: 모든 시대 칸은 START 에서 도달 가능, 끝(END/GOAL/귀환) 외에는 다음 칸이 있음, 분기점은 next 2개
assert.equal(BOARD.tiles.filter((t) => t.type === 'goal').length, 1);
ERAS.forEach((e, i) => {
  const seen = new Set();
  const stack = [BOARD.eraStart[i]];
  while (stack.length) { const c = stack.pop(); if (seen.has(c)) continue; seen.add(c); stack.push(...BOARD.tiles[c].next); }
  for (const t of BOARD.tiles.filter((x) => x.era === i)) {
    assert.ok(seen.has(t.i), 'reachable ' + t.i);
    if (t.type !== 'end' && t.type !== 'goal') assert.ok(t.next.length >= 1, 'has next ' + t.i);
    for (const n of t.next) assert.equal(BOARD.tiles[n].era, i, 'same era');
  }
});
for (const b of BOARD.branches) assert.equal(BOARD.tiles[b.junction].next.length, 2);

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
// docs/ADR.md §12.2 칸 구성표(시대 × 길)와 일치하는지 (ADR 과 코드의 일관성 보장)
{
  const expected = {"baby": {"main": {"start": 1, "star3": 1, "choice": 1, "hiyari": 1, "star1": 6, "star2": 2, "card": 1, "end": 1}}, "elem": {"main": {"start": 1, "choice": 3, "ghost": 1, "star1": 10, "star2": 4, "payday": 3, "hiyari": 3, "star3": 1, "card": 1, "end": 1}}, "middle": {"main": {"start": 1, "star2": 4, "star1": 10, "hiyari": 3, "star3": 1, "payday": 3, "card": 1, "choice": 3, "ghost": 1, "end": 1}}, "high": {"main": {"start": 1, "star1": 7, "hiyari": 2, "star2": 3, "choice": 2, "payday": 3, "ghost": 1, "love": 1, "card": 1, "star3": 1, "end": 1}, "love": {"love": 5, "star1": 1, "star2": 1, "destiny": 1, "hiyari": 1, "choice": 1}, "study": {"star2": 5, "star1": 4, "choice": 2, "card": 2, "hiyari": 1}}, "adult1": {"main": {"start": 1, "star2": 11, "hiyari": 7, "challenge": 7, "star1": 18, "choice": 7, "love": 4, "payday": 3, "ghost": 3, "star3": 4, "baby": 3, "card": 3, "stop:marriage": 1, "travel:countryside": 1, "end": 1}, "love": {"love": 13, "hiyari": 2, "choice": 2, "star1": 5, "destiny": 2, "star2": 2}, "career": {"challenge": 13, "star1": 5, "star2": 8, "hiyari": 2, "card": 2, "payday": 2, "ghost": 2}}, "adult2": {"main": {"start": 1, "choice": 5, "hiyari": 5, "card": 2, "baby": 5, "star1": 12, "love": 2, "star2": 7, "ghost": 5, "challenge": 5, "payday": 3, "stop:house": 1, "travel:casino": 1, "star3": 2, "end": 1}, "love": {"love": 12, "star2": 2, "choice": 2, "star1": 4, "destiny": 2, "hiyari": 2}, "career": {"challenge": 12, "star2": 8, "star1": 4, "ghost": 2, "hiyari": 2, "payday": 2, "card": 2}}, "final": {"main": {"start": 1, "star2": 5, "choice": 3, "ghost": 3, "star1": 10, "star3": 2, "travel:shrine": 1, "hiyari": 3, "card": 1, "payday": 2, "love": 2, "goal": 1}}};
  ERAS.forEach((e, i) => {
    const r = {};
    BOARD.tiles.filter((t) => t.era === i).forEach((t) => { r[t.route] = r[t.route] || {}; const k = t.type + (t.stop ? ':' + t.stop : '') + (t.sub ? ':' + t.sub : ''); r[t.route][k] = (r[t.route][k] || 0) + 1; });
    assert.deepEqual(r, expected[e.id], 'ADR §12.2 mismatch: ' + e.id);
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

// 분기점: 길 선택 후 남은 칸을 이어서 이동 (ADR §6.11)
{
  const br = BOARD.branches.find((b) => b.era === 4);
  const s = createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], mode: 'adult', seed: 11 });
  while (s.pending && s.pending.type === 'choice') applyAction(s, s.pending.playerId, cpuAction(s, () => 0.1));
  const pl = s.players.find((x) => x.id === s.pending.playerId);
  pl.tile = br.junction - 1; pl.cards = ['fixed'];
  applyAction(s, pl.id, { type: 'card', index: 0, number: 3 });
  applyAction(s, pl.id, { type: 'spin', power: 0 });
  assert.equal(s.pending.kind, 'route');
  assert.equal(s.pending.remaining, 2);
  const bIdx = s.pending.options.findIndex((o) => o.route === 'career');
  applyAction(s, pl.id, { type: 'choose', index: bIdx });
  assert.equal(pl.tile, br.b[1], '커리어 길 2번째 칸');
}

// 여행 칸 → 서브맵 → 귀환 칸에서 지름길로 복귀 (ADR §6.12)
{
  const tr = BOARD.tiles.find((t) => t.type === 'travel' && t.sub === 'countryside');
  const s = createGame({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], mode: 'adult', seed: 12 });
  while (s.pending && s.pending.type === 'choice') applyAction(s, s.pending.playerId, cpuAction(s, () => 0.1));
  const pl = s.players.find((x) => x.id === s.pending.playerId);
  let prevTile = BOARD.tiles.find((t) => t.next.includes(tr.i));
  pl.tile = prevTile.i; pl.cards = ['fixed'];
  applyAction(s, pl.id, { type: 'card', index: 0, number: 1 });
  applyAction(s, pl.id, { type: 'spin', power: 0 });
  assert.equal(s.pending.kind, 'travel');
  applyAction(s, pl.id, { type: 'choose', index: 0 });
  assert.equal(pl.tile, BOARD.subStart.countryside);
  assert.equal(pl.subReturn, tr.ret);
  // 귀환 칸 바로 앞에서 10칸을 돌려도 귀환 칸에서 멈추고 본 맵으로
  const ret = BOARD.tiles.find((t) => t.sub === 'countryside' && t.type === 'return');
  while (s.pending.playerId !== pl.id || s.pending.type !== 'spin') applyAction(s, s.pending.playerId, cpuAction(s, () => 0.5));
  pl.tile = ret.i - 1; pl.cards = ['fixed']; pl.cardUsed = false;
  applyAction(s, pl.id, { type: 'card', index: 0, number: 10 });
  applyAction(s, pl.id, { type: 'spin', power: 0 });
  assert.equal(pl.tile, tr.ret, '지름길로 복귀');
  assert.equal(pl.subReturn, null);
}

console.log('engine ok — actions:', totalActions, JSON.stringify(stats));
