/* Node tests for economy. Run: node test/test_economy.js */
var Econ = require('../js/economy.js');

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }
function P(id, chips, skill) { return { id: id, name: id, chips: chips, volleyballSkill: skill || 0.6 }; }

// --- pickFighters: two poorest fight ---
(function () {
  var players = [P('a', 0), P('b', 800), P('c', 1500), P('d', 200), P('e', 3000)];
  var r = Econ.pickFighters(players);
  var fids = r.fighters.map(function (p) { return p.id; }).sort();
  ok(fids.join(',') === 'a,d', 'two poorest (a=0,d=200) are fighters');
  ok(r.bettors.length === 3, 'three bettors');
})();

// --- resolveFight parimutuel ---
(function () {
  // winner=W, loser=L. Bettors: x bets 100 on W, y bets 100 on L, z bets 50 on L.
  var bets = [
    { playerId: 'x', pickId: 'W', amount: 100 },
    { playerId: 'y', pickId: 'L', amount: 100 },
    { playerId: 'z', pickId: 'L', amount: 50 }
  ];
  var res = Econ.resolveFight('W', 'L', bets, { winnerPrize: 500, loserPrize: 250 });
  // winPool=100, losePool=150. x gets stake(100)+all 150 = 250 (net +150).
  ok(res.deltas['W'] === 500, 'winner fighter gets prize');
  ok(res.deltas['L'] === 250, 'loser fighter gets consolation');
  ok(res.deltas['x'] === 250, 'winning bettor gets stake + losers pool (250)');
  ok(res.deltas['y'] === undefined || res.deltas['y'] === 0 || !('y' in res.deltas), 'losing bettor y gets nothing back');
  var xp = res.payouts.find(function (p) { return p.playerId === 'x'; });
  ok(xp.net === 150, 'x net profit 150');
  var yp = res.payouts.find(function (p) { return p.playerId === 'y'; });
  ok(yp.net === -100, 'y net loss 100');
})();

// --- resolveFight: nobody backs winner -> pool boosts winner ---
(function () {
  var bets = [
    { playerId: 'y', pickId: 'L', amount: 100 },
    { playerId: 'z', pickId: 'L', amount: 80 }
  ];
  var res = Econ.resolveFight('W', 'L', bets, { winnerPrize: 500, loserPrize: 250 });
  ok(res.deltas['W'] === 500 + 180, 'winner gets prize + forfeited 180 pool');
})();

// --- bet escrow + payout chip-flow conservation among bettors ---
(function () {
  // Simulate full flow: deduct stakes, then apply deltas. The bettors' net change
  // should equal +(winnings) and -(stakes); the only injected money is prizes.
  var W = P('W', 0), L = P('L', 100), x = P('x', 500), y = P('y', 500), z = P('z', 500);
  var players = [W, L, x, y, z];
  var bets = [
    { playerId: 'x', pickId: 'W', amount: 100 },
    { playerId: 'y', pickId: 'L', amount: 100 },
    { playerId: 'z', pickId: 'W', amount: 100 }
  ];
  var beforeBettors = x.chips + y.chips + z.chips; // 500*3 = 1500 (pre-escrow)
  // escrow
  bets.forEach(function (b) { players.find(function (p) { return p.id === b.playerId; }).chips -= b.amount; });
  var res = Econ.resolveFight('W', 'L', bets, { winnerPrize: 500, loserPrize: 250 });
  Econ.applyDeltas(players, res.deltas);
  // winPool=200 (x,z), losePool=100 (y). x and z each get 100 + 50 = 150 back.
  ok(x.chips === 400 + 150, 'x final after escrow+payout');
  ok(z.chips === 400 + 150, 'z final after escrow+payout');
  ok(y.chips === 400, 'y stays (lost stake)');
  var afterBettors = x.chips + y.chips + z.chips;
  ok(afterBettors - beforeBettors === 0, 'betting is zero-sum among bettors (no injection from bets)');
  ok(W.chips === 500 && L.chips === 100 + 250, 'fighters got injected prizes');
})();

// --- champion detection ---
(function () {
  var players = [P('a', 3100), P('b', 500), P('c', 1400)];
  ok(Econ.checkChampion(players, 3000).id === 'a', 'a is champion at 3100');
  ok(Econ.checkChampion([P('a', 100), P('b', 200)], 3000) === null, 'no champion below target');
})();

// --- aiBet sanity ---
(function () {
  var rng = (function () { var s = 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  var b = Econ.aiBet(P('x', 1000), P('W', 0, 0.8), P('L', 100, 0.5), rng);
  ok(b && b.amount > 0 && b.amount <= 1000, 'aiBet returns valid amount');
  ok(b.pickId === 'W' || b.pickId === 'L', 'aiBet picks a fighter');
  ok(Econ.aiBet(P('broke', 0), P('W', 0), P('L', 0), rng) === null, 'broke bettor cannot bet');
})();

console.log('\neconomy: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
