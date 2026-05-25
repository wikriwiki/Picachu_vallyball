/* Node tests for handEvaluator + cards. Run: node test/test_hand.js */
var Cards = require('../js/cards.js');
var HE = require('../js/handEvaluator.js');

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL: ' + msg); }
}
function C(str) {
  // "Ah" "Ts" "2c" ... -> card object
  var m = str.length === 3 ? str.slice(0, 2) : str[0];
  var rankStr = str.slice(0, str.length - 1);
  var suit = str[str.length - 1];
  var map = { 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  var rank = map[rankStr] || parseInt(rankStr, 10);
  return Cards.makeCard(rank, suit);
}
function hand(strs) { return strs.map(C); }
function cat(strs) { return HE.evaluate(hand(strs)).category; }

// --- Category detection (7-card) ---
ok(cat(['As', 'Ks', 'Qs', 'Js', 'Ts', '2c', '3d']) === 8, 'royal/straight flush');
ok(cat(['9s', '8s', '7s', '6s', '5s', '2c', '3d']) === 8, 'straight flush mid');
ok(cat(['As', '2s', '3s', '4s', '5s', 'Kc', 'Qd']) === 8, 'wheel straight flush');
ok(cat(['As', 'Ah', 'Ad', 'Ac', 'Ks', '2c', '3d']) === 7, 'four of a kind');
ok(cat(['As', 'Ah', 'Ad', 'Ks', 'Kh', '2c', '3d']) === 6, 'full house');
ok(cat(['As', 'Ah', 'Ad', 'Kh', 'Kc', 'Qd', 'Qs']) === 6, 'full house picks best trips');
ok(cat(['As', 'Ks', '9s', '5s', '2s', '2c', '3d']) === 5, 'flush');
ok(cat(['As', 'Kd', 'Qh', 'Jc', 'Ts', '2c', '3d']) === 4, 'broadway straight');
ok(cat(['As', '2d', '3h', '4c', '5s', 'Kc', 'Qd']) === 4, 'wheel straight (A-5)');
ok(cat(['As', 'Ah', 'Ad', 'Kh', 'Qc', 'Jd', '9s']) === 3, 'trips');
ok(cat(['As', 'Ah', 'Kd', 'Kh', 'Qc', 'Jd', '9s']) === 2, 'two pair');
ok(cat(['As', 'Ah', 'Kd', 'Qh', 'Jc', '9d', '7s']) === 1, 'one pair');
ok(cat(['As', 'Kh', 'Qd', 'Jc', '9s', '7d', '5h']) === 0, 'high card');

// --- Comparisons ---
function better(a, b) {
  return HE.compareScore(HE.evaluate(hand(a)).score, HE.evaluate(hand(b)).score) > 0;
}
// Flush beats straight
ok(better(['As', 'Ks', '9s', '5s', '2s', '2c', '3d'],
          ['As', 'Kd', 'Qh', 'Jc', 'Ts', '2c', '4d']), 'flush > straight');
// Higher full house wins
ok(better(['As', 'Ah', 'Ad', 'Kh', 'Kc', '2c', '3d'],
          ['Ks', 'Kh', 'Kd', 'Qh', 'Qc', '2s', '3h']), 'AAA-KK > KKK-QQ');
// Kicker decides one pair
ok(better(['As', 'Ah', 'Kd', 'Qh', 'Jc', '2d', '3s'],
          ['As', 'Ah', 'Kd', 'Qh', 'Tc', '2d', '3s']), 'pair higher kicker wins');
// Same hand = tie
ok(HE.compareScore(HE.evaluate(hand(['As', 'Ah', 'Kd', 'Qh', 'Jc', '2d', '3s'])).score,
                   HE.evaluate(hand(['Ac', 'Ad', 'Kh', 'Qs', 'Js', '2c', '3h'])).score) === 0,
   'identical pair+kickers tie');
// Two pair: higher top pair wins even with lower second pair
ok(better(['As', 'Ah', '3d', '3h', 'Kc', '2d', '7s'],
          ['Ks', 'Kh', 'Qd', 'Qh', 'Ac', '2d', '7s']), 'AA33 > KKQQ');
// Straight: wheel is the lowest straight (6-high beats 5-high wheel)
ok(better(['6s', '5d', '4h', '3c', '2s', 'Kc', 'Qd'],
          ['As', '2d', '3h', '4c', '5s', 'Kc', 'Qd']), '6-high straight > wheel');

// --- Deck sanity ---
var d = Cards.freshDeck();
ok(d.length === 52, 'deck has 52 cards');
var ids = {};
d.forEach(function (c) { ids[c.id] = true; });
ok(Object.keys(ids).length === 52, 'deck has 52 unique cards');
// Deterministic shuffle reproducibility
function lcg(seed) { var s = seed; return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
var s1 = Cards.shuffle(d, lcg(42)).map(function (c) { return c.id; }).join(',');
var s2 = Cards.shuffle(d, lcg(42)).map(function (c) { return c.id; }).join(',');
ok(s1 === s2, 'seeded shuffle is deterministic');
ok(Cards.shuffle(d, lcg(42)).length === 52, 'shuffle preserves count');

console.log('\nhandEvaluator/cards: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
