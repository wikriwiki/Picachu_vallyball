/* Node tests for the Hold'em engine. Run: node test/test_holdem.js */
var Holdem = require('../js/holdem.js').Holdem;

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('FAIL: ' + msg); }
}

// Seeded RNG (mulberry32) for reproducibility.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePlayers(n, chips) {
  var arr = [];
  for (var i = 0; i < n; i++) arr.push({ id: 'p' + i, name: 'P' + i, chips: chips, isHuman: false });
  return arr;
}
function totalChips(players) {
  return players.reduce(function (a, p) { return a + p.chips; }, 0);
}

// Auto-player: drives a hand to completion with random-but-legal actions.
function playHand(game, rng) {
  game.startHand();
  var guard = 0;
  while (game.phase === 'betting') {
    if (++guard > 5000) throw new Error('hand did not terminate');
    var actor = game.getActor();
    if (!actor) break;
    var la = game.legalActions(actor.id);
    var roll = rng();
    if (la.canRaise && roll > 0.7) {
      var lo = la.minRaiseTo, hi = la.maxRaiseTo;
      var to = Math.floor(lo + rng() * (hi - lo + 1));
      game.act(actor.id, 'raise', to);
    } else if (la.canCheck) {
      // occasionally bet out
      if (la.canRaise && roll > 0.85) game.act(actor.id, 'raise', la.minRaiseTo);
      else game.act(actor.id, 'check');
    } else if (la.canCall) {
      if (roll < 0.15) game.act(actor.id, 'fold');
      else game.act(actor.id, 'call');
    } else {
      game.act(actor.id, 'fold');
    }
  }
}

// --- Fuzz test: chip conservation & no negatives across many hands ---
(function () {
  var rng = mulberry32(12345);
  var players = makePlayers(5, 1000);
  var start = totalChips(players);
  var game = new Holdem(players, { smallBlind: 10, bigBlind: 20, rng: rng });
  var hands = 0, conservationOk = true, noNegative = true;
  for (var h = 0; h < 400; h++) {
    // Reset busted players so we can keep dealing (mimic economy revive).
    players.forEach(function (p) { if (p.chips <= 0) p.chips = 200; });
    var before = totalChips(players);
    try {
      playHand(game, rng);
    } catch (e) {
      ok(false, 'hand threw: ' + e.message);
      break;
    }
    var after = totalChips(players);
    if (after !== before) { conservationOk = false; console.error('   conservation broke at hand ' + h + ': ' + before + ' -> ' + after); }
    players.forEach(function (p) { if (p.chips < 0) noNegative = false; });
    hands++;
  }
  ok(hands === 400, 'played 400 hands without throwing (got ' + hands + ')');
  ok(conservationOk, 'chip total conserved within each hand');
  ok(noNegative, 'no player ever went negative');
})();

// --- Targeted side-pot math test ---
(function () {
  var players = makePlayers(3, 0);
  var game = new Holdem(players, {});
  // Manually construct seats to test _buildPots in isolation.
  game.seats = [
    { player: players[0], committedTotal: 100, status: 'allin' },  // short stack all-in 100
    { player: players[1], committedTotal: 300, status: 'active' }, // covers, contributes 300
    { player: players[2], committedTotal: 300, status: 'active' }  // covers, contributes 300
  ];
  var pots = game._buildPots();
  // Layer 1: level 100, 3 contributors -> 300, eligible all 3.
  // Layer 2: level 300, 2 contributors (200 each) -> 400, eligible p1,p2.
  var total = pots.reduce(function (a, p) { return a + p.amount; }, 0);
  ok(total === 700, 'side pots sum to total committed (got ' + total + ')');
  ok(pots.length === 2, 'two pots formed (got ' + pots.length + ')');
  ok(pots[0].amount === 300 && pots[0].eligible.length === 3, 'main pot 300 / 3 eligible');
  ok(pots[1].amount === 400 && pots[1].eligible.length === 2, 'side pot 400 / 2 eligible');
})();

// --- Side pot with a folded contributor (dead money) ---
(function () {
  var players = makePlayers(3, 0);
  var game = new Holdem(players, {});
  game.seats = [
    { player: players[0], committedTotal: 50, status: 'folded' },  // folded but money stays
    { player: players[1], committedTotal: 200, status: 'active' },
    { player: players[2], committedTotal: 200, status: 'active' }
  ];
  var pots = game._buildPots();
  var total = pots.reduce(function (a, p) { return a + p.amount; }, 0);
  ok(total === 450, 'folded contribution counted in pot (got ' + total + ')');
  // Layer at level 50: 3 contributors -> 150, eligible = p1,p2 (p0 folded).
  ok(pots[0].amount === 150 && pots[0].eligible.length === 2, 'folded player not eligible for layer');
})();

// --- Heads-up sanity: blinds posted, hand completes ---
(function () {
  var rng = mulberry32(99);
  var players = makePlayers(2, 500);
  var game = new Holdem(players, { smallBlind: 5, bigBlind: 10, rng: rng });
  var before = totalChips(players);
  playHand(game, rng);
  ok(totalChips(players) === before, 'heads-up conserves chips');
  ok(game.phase === 'handover', 'heads-up reaches handover');
})();

console.log('\nholdem engine: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
