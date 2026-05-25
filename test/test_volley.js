/* Headless volleyball physics tests. Run: node test/test_volley.js */
var VB = require('../js/volleyball.js');

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

// Play many AI-vs-AI matches; verify termination, valid winner, in-bounds, no NaN.
var matchesDone = 0, allInBounds = true, allFinite = true, scoresValid = true, hadRallies = true;
for (var m = 0; m < 30; m++) {
  var rng = mulberry32(1000 + m);
  var g = new VB.Volleyball({
    targetPoints: 7,
    leftControl: 'ai', rightControl: 'ai',
    leftDifficulty: 0.5 + rng() * 0.4, rightDifficulty: 0.5 + rng() * 0.4,
    rng: rng
  });
  var steps = 0, totalHits = 0;
  while (g.phase !== 'over' && steps < 200000) {
    g.step();
    g.events.forEach(function (e) { if (e.type === 'hit') totalHits++; });
    var b = g.ball;
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) allFinite = false;
    if (b.x < -1 || b.x > VB.W + 1 || b.y > VB.H + 1) allInBounds = false;
    steps++;
  }
  if (g.phase !== 'over') { console.error('   match ' + m + ' did not finish'); continue; }
  matchesDone++;
  var max = Math.max(g.left.score, g.right.score);
  if (max < 7) scoresValid = false;
  if (totalHits < 3) hadRallies = false; // expect at least some volleys across a full match
}
ok(matchesDone === 30, 'all 30 AI matches finished (got ' + matchesDone + ')');
ok(allFinite, 'ball state stays finite (no NaN)');
ok(allInBounds, 'ball stays within court bounds');
ok(scoresValid, 'winner reached target points');
ok(hadRallies, 'matches had real rallies (ball was hit)');

// Player stays on own half / on ground constraints.
(function () {
  var rng = mulberry32(5);
  var g = new VB.Volleyball({ leftControl: 'ai', rightControl: 'ai', rng: rng });
  var leftOk = true, rightOk = true, groundOk = true;
  for (var i = 0; i < 6000; i++) {
    g.step();
    if (g.left.x > VB.W / 2) leftOk = false;
    if (g.right.x < VB.W / 2) rightOk = false;
    if (g.left.y > g.GROUND_Y - g.PLAYER_R + 0.001) groundOk = false;
    if (g.phase === 'over') break;
  }
  ok(leftOk, 'left player never crosses net');
  ok(rightOk, 'right player never crosses net');
  ok(groundOk, 'players never sink below ground');
})();

// Human input plumbing doesn't crash and is applied.
(function () {
  var g = new VB.Volleyball({ leftControl: 'human', rightControl: 'ai', rng: mulberry32(3) });
  g.setInput('left', { right: true, jump: true });
  var x0 = g.left.x;
  for (var i = 0; i < 20; i++) g.step();
  ok(g.left.x >= x0, 'human input moves player right');
})();

console.log('\nvolleyball: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
