/*
 * End-to-end meta-loop test. Mirrors main.js sequencing WITHOUT the DOM:
 *   holdem hands -> bankruptcy -> AI-vs-AI volleyball + AI bets -> revive -> champion.
 * Verifies the whole loop terminates, stays consistent, and crowns a champion.
 * Run: node test/test_integration.js
 */
var Holdem = require('../js/holdem.js').Holdem;
var AI = require('../js/holdemAI.js');
var VB = require('../js/volleyball.js');
var Econ = require('../js/economy.js');

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

var CFG = { startChips: 1000, smallBlind: 10, bigBlind: 20, championTarget: 3500, winnerPrize: 500, loserPrize: 250, targetPoints: 7 };

function runFullGame(seed) {
  var rng = mulberry32(seed);
  var players = [];
  for (var i = 0; i < 5; i++) {
    players.push({
      id: 'p' + i, name: 'P' + i, chips: CFG.startChips, isHuman: false,
      volleyballSkill: 0.5 + rng() * 0.4
    });
  }
  var profiles = {};
  players.forEach(function (p) {
    profiles[p.id] = { aggression: 0.35 + rng() * 0.5, looseness: 0.3 + rng() * 0.45, bluff: rng() * 0.16 };
  });
  var holdem = new Holdem(players, { smallBlind: CFG.smallBlind, bigBlind: CFG.bigBlind, rng: rng });

  var anyNegative = false;
  var metaSteps = 0;
  var fightsRun = 0;
  var handsRun = 0;

  function anyBankrupt() { return players.some(function (p) { return p.chips <= 0; }); }
  function champ() { return Econ.checkChampion(players, CFG.championTarget); }
  function checkNeg() { players.forEach(function (p) { if (p.chips < 0) anyNegative = true; }); }

  while (metaSteps++ < 100000) {
    if (champ()) break;

    if (anyBankrupt()) {
      // Resolve fights until everyone is solvent (or a champion emerges).
      var fightGuard = 0;
      while (anyBankrupt() && fightGuard++ < 50) {
        var pick = Econ.pickFighters(players);
        var left = pick.fighters[0], right = pick.fighters[1];
        // AI bets (escrow).
        var bets = [];
        pick.bettors.forEach(function (b) {
          var bet = Econ.aiBet(b, left, right, rng);
          if (bet) { b.chips -= bet.amount; bets.push(bet); }
        });
        checkNeg();
        // Simulate AI-vs-AI volleyball.
        var vb = new VB.Volleyball({
          targetPoints: CFG.targetPoints,
          leftControl: 'ai', rightControl: 'ai',
          leftDifficulty: left.volleyballSkill, rightDifficulty: right.volleyballSkill,
          rng: rng
        });
        var guard = 0;
        while (vb.phase !== 'over' && guard++ < 500000) vb.step();
        if (vb.phase !== 'over') return { error: 'volleyball did not finish' };
        var winner = vb.winner === 'left' ? left : right;
        var loser = vb.winner === 'left' ? right : left;
        var res = Econ.resolveFight(winner.id, loser.id, bets, CFG);
        Econ.applyDeltas(players, res.deltas);
        checkNeg();
        fightsRun++;
        if (champ()) break;
      }
      if (anyBankrupt()) return { error: 'still bankrupt after fight loop' };
      continue;
    }

    // Play one holdem hand (all AI).
    holdem.startHand();
    var actGuard = 0;
    while (holdem.phase === 'betting') {
      if (actGuard++ > 5000) return { error: 'hand stuck' };
      var actor = holdem.getActor();
      if (!actor) break;
      var d = AI.decide(holdem, actor.id, profiles[actor.id], rng);
      try { holdem.act(actor.id, d.type, d.amount); }
      catch (e) {
        var la = holdem.legalActions(actor.id);
        holdem.act(actor.id, la && la.canCheck ? 'check' : 'fold');
      }
    }
    checkNeg();
    handsRun++;
  }

  return {
    champion: champ(),
    anyNegative: anyNegative,
    fightsRun: fightsRun,
    handsRun: handsRun,
    metaSteps: metaSteps,
    totalChips: players.reduce(function (a, p) { return a + p.chips; }, 0)
  };
}

var games = 0, championsFound = 0, neg = false, errs = 0, totalFights = 0, totalHands = 0;
for (var s = 1; s <= 25; s++) {
  var r = runFullGame(s * 31 + 7);
  games++;
  if (r.error) { errs++; console.error('   seed ' + s + ' error: ' + r.error); continue; }
  if (r.champion) championsFound++;
  if (r.anyNegative) neg = true;
  totalFights += r.fightsRun;
  totalHands += r.handsRun;
}

ok(errs === 0, 'no errors across 25 full games (errs=' + errs + ')');
ok(championsFound === games, 'every game produced a champion (' + championsFound + '/' + games + ')');
ok(!neg, 'no player chips ever went negative across all games');
ok(totalFights > 0, 'volleyball fights actually occurred (total=' + totalFights + ')');
console.log('   stats: avg hands/game=' + Math.round(totalHands / games) + ', avg fights/game=' + (totalFights / games).toFixed(1));

console.log('\nintegration: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
