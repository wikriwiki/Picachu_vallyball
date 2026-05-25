/*
 * handEvaluator.js — Texas Hold'em hand evaluation.
 * Evaluates the best 5-card hand out of 7 cards.
 *
 * A hand "score" is an array [category, ...tiebreakers] compared
 * lexicographically (bigger = better). Categories:
 *   0 High Card, 1 Pair, 2 Two Pair, 3 Trips, 4 Straight,
 *   5 Flush, 6 Full House, 7 Quads, 8 Straight Flush.
 */
(function (global) {
  'use strict';

  var CATEGORY_NAMES = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  var CATEGORY_NAMES_KO = [
    '하이 카드', '원 페어', '투 페어', '트리플', '스트레이트',
    '플러시', '풀 하우스', '포 카드', '스트레이트 플러시'
  ];

  // Compare two score arrays. Returns >0 if a wins, <0 if b wins, 0 tie.
  function compareScore(a, b) {
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      var av = a[i] === undefined ? -1 : a[i];
      var bv = b[i] === undefined ? -1 : b[i];
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  // Detect a straight from a sorted-desc unique rank list.
  // Returns the high card of the straight, or 0 if none.
  function straightHigh(uniqueDesc) {
    // Build a presence set for quick checks (wheel handling for Ace=14 -> 1).
    var present = {};
    for (var i = 0; i < uniqueDesc.length; i++) present[uniqueDesc[i]] = true;
    // Ace can be low (value 1) for A-2-3-4-5.
    var ranks = uniqueDesc.slice();
    if (present[14]) ranks.push(1); // add low ace as 1
    ranks.sort(function (x, y) { return y - x; }); // desc, may have dup 1? no
    // Walk for 5 consecutive.
    var run = 1;
    for (var k = 0; k < ranks.length - 1; k++) {
      if (ranks[k] - 1 === ranks[k + 1]) {
        run++;
        if (run >= 5) return ranks[k - 3]; // high card of this run
      } else if (ranks[k] === ranks[k + 1]) {
        // duplicate (shouldn't happen with unique list) — skip
      } else {
        run = 1;
      }
    }
    return 0;
  }

  // Evaluate exactly 5 cards -> score array.
  function rank5(cards) {
    var ranks = cards.map(function (c) { return c.rank; });
    var suits = cards.map(function (c) { return c.suit; });

    // Count occurrences of each rank.
    var counts = {};
    ranks.forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });

    // Sorted list of [rank, count], ordered by count desc then rank desc.
    var grouped = Object.keys(counts).map(function (r) {
      return [parseInt(r, 10), counts[r]];
    });
    grouped.sort(function (a, b) {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

    var isFlush = suits.every(function (s) { return s === suits[0]; });

    var uniqueDesc = grouped.map(function (g) { return g[0]; }).slice();
    // uniqueDesc currently ordered by count then rank; for straight detection
    // we need pure rank-desc unique.
    var pureDesc = Object.keys(counts).map(function (r) { return parseInt(r, 10); });
    pureDesc.sort(function (a, b) { return b - a; });
    var sHigh = (pureDesc.length === 5) ? straightHigh(pureDesc) : 0;

    var countPattern = grouped.map(function (g) { return g[1]; }).join('');

    // Straight flush
    if (isFlush && sHigh) return [8, sHigh];
    // Four of a kind: pattern 41
    if (countPattern === '41') return [7, grouped[0][0], grouped[1][0]];
    // Full house: pattern 32
    if (countPattern === '32') return [6, grouped[0][0], grouped[1][0]];
    // Flush
    if (isFlush) return [5].concat(pureDesc);
    // Straight
    if (sHigh) return [4, sHigh];
    // Trips: 311
    if (countPattern === '311') return [3, grouped[0][0], grouped[1][0], grouped[2][0]];
    // Two pair: 221
    if (countPattern === '221') return [2, grouped[0][0], grouped[1][0], grouped[2][0]];
    // One pair: 2111
    if (countPattern === '2111') {
      return [1, grouped[0][0], grouped[1][0], grouped[2][0], grouped[3][0]];
    }
    // High card
    return [0].concat(pureDesc);
  }

  // Generate all 5-card combinations of an array of cards.
  function combinations5(cards) {
    var res = [];
    var n = cards.length;
    for (var a = 0; a < n - 4; a++)
      for (var b = a + 1; b < n - 3; b++)
        for (var c = b + 1; c < n - 2; c++)
          for (var d = c + 1; d < n - 1; d++)
            for (var e = d + 1; e < n; e++)
              res.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
    return res;
  }

  // Evaluate best 5-card hand from up to 7 cards.
  // Returns { score, cards (best 5), category, name, nameKo }.
  function evaluate(cards) {
    if (cards.length < 5) {
      throw new Error('evaluate needs at least 5 cards, got ' + cards.length);
    }
    var combos = (cards.length === 5) ? [cards] : combinations5(cards);
    var best = null;
    var bestCards = null;
    for (var i = 0; i < combos.length; i++) {
      var sc = rank5(combos[i]);
      if (best === null || compareScore(sc, best) > 0) {
        best = sc;
        bestCards = combos[i];
      }
    }
    return {
      score: best,
      cards: bestCards,
      category: best[0],
      name: CATEGORY_NAMES[best[0]],
      nameKo: CATEGORY_NAMES_KO[best[0]]
    };
  }

  var api = {
    CATEGORY_NAMES: CATEGORY_NAMES,
    CATEGORY_NAMES_KO: CATEGORY_NAMES_KO,
    compareScore: compareScore,
    rank5: rank5,
    evaluate: evaluate,
    combinations5: combinations5
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.HandEvaluator = api;
})(typeof window !== 'undefined' ? window : globalThis);
