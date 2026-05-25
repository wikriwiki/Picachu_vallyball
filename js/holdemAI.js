/*
 * holdemAI.js — decision logic for poker bots.
 * Uses a small Monte-Carlo equity estimate vs a random opponent,
 * adjusted for the number of opponents, modulated by per-bot personality.
 */
(function (global) {
  'use strict';

  var Cards = (typeof require !== 'undefined') ? require('./cards.js') : global.Cards;
  var HE = (typeof require !== 'undefined') ? require('./handEvaluator.js') : global.HandEvaluator;

  // Default personality. aggression/looseness/bluff in [0,1].
  function defaultProfile() {
    return { aggression: 0.5, looseness: 0.5, bluff: 0.08 };
  }

  // Preflop strength [0,1] from two hole cards (simplified Chen-style).
  function preflopStrength(hole) {
    var a = hole[0], b = hole[1];
    var hi = Math.max(a.rank, b.rank), lo = Math.min(a.rank, b.rank);
    var suited = a.suit === b.suit;
    var pair = a.rank === b.rank;
    // Base from high card (scaled), Ace=14.
    var score = (hi - 2) / 12 * 0.5;
    if (pair) {
      score = 0.5 + (hi - 2) / 12 * 0.5; // pairs strong, AA ~1.0
    } else {
      score += (lo - 2) / 12 * 0.2;
      if (suited) score += 0.08;
      var gap = hi - lo;
      if (gap === 1) score += 0.06;       // connectors
      else if (gap === 2) score += 0.03;
      else if (gap >= 4) score -= 0.05;   // big gap penalty
    }
    return Math.max(0, Math.min(1, score));
  }

  function buildUnseen(hole, community) {
    var seen = {};
    hole.concat(community).forEach(function (c) { seen[c.id] = true; });
    return Cards.freshDeck().filter(function (c) { return !seen[c.id]; });
  }

  // Monte-Carlo equity vs a single random opponent on the current board.
  function equityVsOne(hole, community, rng, samples) {
    samples = samples || 120;
    var unseen = buildUnseen(hole, community);
    var wins = 0, ties = 0;
    for (var s = 0; s < samples; s++) {
      // Shallow shuffle the unseen pool (partial Fisher-Yates is enough).
      var pool = unseen.slice();
      var need = 2 + (5 - community.length);
      for (var i = 0; i < need; i++) {
        var j = i + Math.floor(rng() * (pool.length - i));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      var oppHole = [pool[0], pool[1]];
      var board = community.slice();
      for (var k = 0; k < 5 - community.length; k++) board.push(pool[2 + k]);
      var my = HE.evaluate(hole.concat(board)).score;
      var op = HE.evaluate(oppHole.concat(board)).score;
      var cmp = HE.compareScore(my, op);
      if (cmp > 0) wins++;
      else if (cmp === 0) ties++;
    }
    return (wins + ties * 0.5) / samples;
  }

  // Equity adjusted for facing multiple opponents.
  function fieldEquity(hole, community, opponents, rng) {
    var base;
    if (community.length === 0) base = preflopStrength(hole);
    else base = equityVsOne(hole, community, rng, 140);
    var n = Math.max(1, opponents);
    return Math.pow(base, 0.75 + 0.35 * (n - 1));
  }

  // Decide an action. Returns { type, amount } usable with game.act().
  function decide(game, playerId, profile, rng) {
    rng = rng || Math.random;
    profile = profile || defaultProfile();
    var la = game.legalActions(playerId);
    if (!la) return null;
    var seat = game.seatOf(playerId);
    var hole = seat.hole;
    var community = game.community;

    // Count opponents still in the hand.
    var opponents = 0;
    game.seats.forEach(function (s) {
      if (s.player.id !== playerId && (s.status === 'active' || s.status === 'allin')) opponents++;
    });

    var eq = fieldEquity(hole, community, opponents, rng);
    var pot = game.totalPot();
    var toCall = la.callAmount;
    var potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    var chips = la.chips;

    // Personality-driven thresholds.
    var aggr = profile.aggression, loose = profile.looseness, bluff = profile.bluff;
    var roll = rng();

    // Helper to produce a sized raise ("raise to" target), clamped to legal range.
    function sizedRaise(factor) {
      if (!la.canRaise) return null;
      var raiseChips = Math.round((pot + toCall) * factor);
      var target = la.currentBet + Math.max(raiseChips, game.bigBlind);
      target = Math.max(la.minRaiseTo, Math.min(target, la.maxRaiseTo));
      return target;
    }

    // Short-stack / very strong: shove sometimes.
    var stackToPot = pot > 0 ? chips / pot : 99;

    if (toCall === 0) {
      // No bet to call: check or bet.
      if (eq > 0.66 && roll < 0.55 + aggr * 0.4) {
        var f = 0.45 + aggr * 0.45;
        if (eq > 0.85 && rng() < 0.25) return { type: 'allin' };
        var t = sizedRaise(f);
        if (t) return { type: 'raise', amount: t };
      }
      if (roll < bluff) {
        var tb = sizedRaise(0.5);
        if (tb) return { type: 'raise', amount: tb };
      }
      return { type: 'check' };
    }

    // Facing a bet.
    var callMargin = 0.04 + (1 - loose) * 0.06; // tighter bots need more edge
    if (eq >= potOdds + callMargin) {
      // Profitable: call, sometimes raise for value.
      if (eq > 0.72 && la.canRaise && roll < aggr * 0.7) {
        if (eq > 0.88 && (stackToPot < 1.5 || rng() < 0.3)) return { type: 'allin' };
        var tv = sizedRaise(0.55 + aggr * 0.4);
        if (tv) return { type: 'raise', amount: tv };
      }
      // Don't call off the whole stack with marginal equity.
      if (toCall >= chips && eq < 0.55 && rng() > loose) return { type: 'fold' };
      return { type: 'call' };
    }

    // Unprofitable: usually fold; sometimes bluff-raise or cheap call.
    if (la.canRaise && roll < bluff * 0.8) {
      var tbf = sizedRaise(0.6);
      if (tbf) return { type: 'raise', amount: tbf };
    }
    if (potOdds < 0.12 && rng() < loose * 0.5) return { type: 'call' };
    return { type: 'fold' };
  }

  var api = {
    defaultProfile: defaultProfile,
    preflopStrength: preflopStrength,
    equityVsOne: equityVsOne,
    fieldEquity: fieldEquity,
    decide: decide
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.HoldemAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
