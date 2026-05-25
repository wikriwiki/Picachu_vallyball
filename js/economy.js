/*
 * economy.js — the meta-game that connects Hold'em and Volleyball.
 * Pure logic: choose fighters, resolve parimutuel bets + fighter prizes,
 * detect a champion. No DOM here so it can be unit-tested.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    startChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    championTarget: 3000,
    winnerPrize: 500,   // injected fight money for the volleyball winner
    loserPrize: 250,    // injected fight money for the loser (lets them rejoin)
    targetPoints: 7
  };

  // Anyone at or below 0 chips is bankrupt.
  function bankruptPlayers(players) {
    return players.filter(function (p) { return p.chips <= 0; });
  }

  // The two poorest players fight; the rest are bettors.
  // (When someone is bankrupt this is "the bankrupt player + next poorest".)
  function pickFighters(players) {
    var sorted = players.slice().sort(function (a, b) {
      if (a.chips !== b.chips) return a.chips - b.chips;
      return a.id < b.id ? -1 : 1;
    });
    var fighters = sorted.slice(0, 2);
    var bettors = sorted.slice(2);
    return { fighters: fighters, bettors: bettors };
  }

  /*
   * Resolve a fight.
   *   winnerId, loserId: the two fighters.
   *   bets: [{playerId, pickId, amount}] — amount already escrowed (deducted
   *         from the bettor's chips at bet time). pickId = fighter bet on.
   *   cfg: {winnerPrize, loserPrize}
   * Returns { deltas: {playerId: chipChange}, payouts: [...], summary }.
   * Parimutuel: winning bettors get stake back + proportional share of the
   * losing-bet pool. If nobody backed the winner, that pool boosts the winner's prize.
   */
  function resolveFight(winnerId, loserId, bets, cfg) {
    cfg = cfg || {};
    var winnerPrize = cfg.winnerPrize != null ? cfg.winnerPrize : DEFAULTS.winnerPrize;
    var loserPrize = cfg.loserPrize != null ? cfg.loserPrize : DEFAULTS.loserPrize;

    var deltas = {};
    function add(id, amt) { deltas[id] = (deltas[id] || 0) + amt; }

    // Fighter prizes (house-injected fight money).
    add(winnerId, winnerPrize);
    add(loserId, loserPrize);

    var winningBets = bets.filter(function (b) { return b.pickId === winnerId; });
    var losingBets = bets.filter(function (b) { return b.pickId === loserId; });
    var winPool = winningBets.reduce(function (a, b) { return a + b.amount; }, 0);
    var losePool = losingBets.reduce(function (a, b) { return a + b.amount; }, 0);

    var payouts = [];
    if (winPool > 0) {
      winningBets.forEach(function (b) {
        var profit = Math.floor(b.amount / winPool * losePool);
        var ret = b.amount + profit; // stake back + winnings
        add(b.playerId, ret);
        payouts.push({ playerId: b.playerId, staked: b.amount, returned: ret, net: ret - b.amount, won: true });
      });
      losingBets.forEach(function (b) {
        payouts.push({ playerId: b.playerId, staked: b.amount, returned: 0, net: -b.amount, won: false });
      });
    } else {
      // No one backed the winner: forfeited losing pool boosts the winner's prize.
      add(winnerId, losePool);
      losingBets.forEach(function (b) {
        payouts.push({ playerId: b.playerId, staked: b.amount, returned: 0, net: -b.amount, won: false });
      });
    }

    return {
      deltas: deltas,
      payouts: payouts,
      winPool: winPool,
      losePool: losePool,
      winnerPrize: winnerPrize,
      loserPrize: loserPrize
    };
  }

  // Apply chip deltas to player objects.
  function applyDeltas(players, deltas) {
    players.forEach(function (p) {
      if (deltas[p.id]) p.chips += deltas[p.id];
    });
  }

  // A champion is the first player to reach the target stack.
  function checkChampion(players, target) {
    target = target || DEFAULTS.championTarget;
    var best = null;
    players.forEach(function (p) {
      if (p.chips >= target && (!best || p.chips > best.chips)) best = p;
    });
    return best;
  }

  // AI bettor: pick a fighter (skill-weighted) and a modest stake.
  function aiBet(bettor, fighterA, fighterB, rng) {
    rng = rng || Math.random;
    if (bettor.chips <= 0) return null;
    var sa = (fighterA.volleyballSkill || 0.6);
    var sb = (fighterB.volleyballSkill || 0.6);
    // Probability of betting on A proportional to skill (with noise).
    var pa = sa / (sa + sb);
    pa = pa * 0.7 + 0.15 + (rng() - 0.5) * 0.2; // add uncertainty
    var pick = (rng() < pa) ? fighterA : fighterB;
    // Stake 6-16% of stack, at least 10, never more than the stack.
    var frac = 0.06 + rng() * 0.10;
    var amount = Math.max(10, Math.round(bettor.chips * frac));
    amount = Math.min(amount, bettor.chips);
    if (amount <= 0) return null;
    return { playerId: bettor.id, pickId: pick.id, amount: amount };
  }

  var api = {
    DEFAULTS: DEFAULTS,
    bankruptPlayers: bankruptPlayers,
    pickFighters: pickFighters,
    resolveFight: resolveFight,
    applyDeltas: applyDeltas,
    checkChampion: checkChampion,
    aiBet: aiBet
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Economy = api;
})(typeof window !== 'undefined' ? window : globalThis);
