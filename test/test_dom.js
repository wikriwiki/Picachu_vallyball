/*
 * Headless DOM smoke test. Loads the real index.html + scripts in jsdom,
 * stubs canvas + drives timers/rAF iteratively, then plays a whole game to
 * completion (holdem -> volleyball fight -> betting -> game over), asserting
 * no runtime errors and that every screen renders.
 * Run: node test/test_dom.js   (requires jsdom)
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var JSDOM = require('jsdom').JSDOM;

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }

// Build HTML with inline scripts (jsdom won't fetch local files).
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var scripts = ['cards', 'handEvaluator', 'holdem', 'holdemAI', 'volleyball', 'economy', 'main'];
scripts.forEach(function (name) {
  var src = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8');
  var tag = '<script src="js/' + name + '.js"></script>';
  html = html.replace(tag, '<script>\n' + src + '\n</script>');
});

var errors = [];
var dom = new JSDOM(html, {
  runScripts: 'dangerously',
  beforeParse: function (win) {
    win.onerror = function (msg) { errors.push(String(msg)); };
    // Stub canvas 2D context: every method is a no-op; gradients support addColorStop.
    var ctxStub = new Proxy({}, {
      get: function (t, p) {
        if (p === 'createLinearGradient' || p === 'createRadialGradient') {
          return function () { return { addColorStop: function () {} }; };
        }
        if (p in t) return t[p];
        return function () {};
      },
      set: function (t, p, v) { t[p] = v; return true; }
    });
    win.HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };

    // Queued timers + rAF so the test can pump them iteratively (no deep recursion).
    win.__timerQ = [];
    win.__rafQ = [];
    win.setTimeout = function (cb) { win.__timerQ.push(cb); return win.__timerQ.length; };
    win.clearTimeout = function () {};
    win.requestAnimationFrame = function (cb) { win.__rafQ.push(cb); return win.__rafQ.length; };
    win.cancelAnimationFrame = function () { win.__rafQ.length = 0; };
  }
});

var win = dom.window;
var doc = win.document;

// Ensure init ran (wire up buttons). main.js registers DOMContentLoaded.
try { doc.dispatchEvent(new win.Event('DOMContentLoaded')); } catch (e) {}

ok(typeof doc.getElementById('btn-start').onclick === 'function', 'start button wired by init');

function activeScreen() {
  var s = doc.querySelector('.screen.active');
  return s ? s.id : null;
}

// Drive the game. Each tick: act on actionable UI; otherwise process one queued cb.
var seen = {};
var frame = 0;
var clickedFightGo = false;
var MAX = 400000;
var iter = 0;
var fightsSeen = 0, volleySeen = 0;

doc.getElementById('btn-start').click();

var humanActions = 0;
var raisesExercised = 0, allinsExercised = 0, betsPlaced = 0;
function clickHumanActionIfAny() {
  var btns = doc.getElementById('action-buttons');
  if (!btns || btns.children.length === 0) return false;
  humanActions++;

  // Find the raise/bet toggle button (text starts with 레이즈 or 벳).
  var raiseToggle = null;
  for (var k = 0; k < btns.children.length; k++) {
    var tx = btns.children[k].textContent;
    if (tx.indexOf('레이즈') === 0 || tx.indexOf('벳') === 0) raiseToggle = btns.children[k];
  }

  // Periodically exercise the raise control (and occasionally all-in).
  if (raiseToggle && humanActions % 4 === 0) {
    raiseToggle.click(); // reveals raise-control
    var slider = doc.getElementById('raise-slider');
    if (humanActions % 8 === 0) {
      slider.value = slider.max; // -> all-in path in confirm
      allinsExercised++;
    } else {
      // exercise a quick preset (½팟) + the slider's oninput handler
      var quick = doc.getElementById('raise-quick');
      var halfBtn = null;
      for (var q = 0; q < quick.children.length; q++) {
        if (quick.children[q].textContent === '½팟') halfBtn = quick.children[q];
      }
      if (halfBtn) halfBtn.click();
      slider.dispatchEvent(new win.Event('input'));
      raisesExercised++;
    }
    doc.getElementById('btn-raise-confirm').click();
    return true;
  }

  // Otherwise prefer check, then call, then fold.
  var chosen = null;
  for (var i = 0; i < btns.children.length; i++) {
    if (btns.children[i].textContent.indexOf('체크') === 0) chosen = btns.children[i];
  }
  if (!chosen) for (var j = 0; j < btns.children.length; j++) {
    if (btns.children[j].textContent.indexOf('콜') === 0) chosen = btns.children[j];
  }
  if (!chosen) chosen = btns.children[0]; // fold
  chosen.click();
  return true;
}

while (iter++ < MAX) {
  var scr = activeScreen();
  if (scr) seen[scr] = true;
  if (scr === 'screen-gameover') break;

  // Handle screen-specific buttons.
  if (scr === 'screen-fight-intro') {
    fightsSeen++;
    // If the human is a bettor, exercise the bet UI: pick a fighter + set a stake.
    var picks = doc.querySelectorAll('#bet-panel .bet-pick');
    if (picks.length > 0) {
      picks[0].click();
      var bs = doc.getElementById('bet-slider');
      if (bs) {
        bs.value = Math.min(40, parseInt(bs.max, 10) || 0);
        bs.dispatchEvent(new win.Event('input'));
        if (parseInt(bs.value, 10) > 0) betsPlaced++;
      }
    }
    var go = doc.getElementById('btn-fight-go');
    go.click(); // proceeds to volleyball (startVolleyball runs synchronously)
    continue;
  }
  if (scr === 'screen-volley') { volleySeen = 1; }
  if (scr === 'screen-fight-result') {
    doc.getElementById('btn-fight-return').click();
    continue;
  }
  if (scr === 'screen-holdem') {
    if (clickHumanActionIfAny()) continue;
  }

  // Otherwise process queued work (timers first, then animation frames).
  try {
    if (win.__timerQ.length) {
      win.__timerQ.shift()();
    } else if (win.__rafQ.length) {
      frame += 16;
      win.__rafQ.shift()(frame);
    } else {
      // Nothing queued and no UI to act on: nudge by clicking human action.
      if (!clickHumanActionIfAny()) break;
    }
  } catch (e) {
    errors.push((e && e.stack) ? e.stack : String(e));
    break;
  }
}

ok(errors.length === 0, 'no runtime errors during full game (' + errors.length + ')' + (errors[0] ? '\n  first: ' + errors[0].split('\n').slice(0, 3).join('\n  ') : ''));
ok(seen['screen-holdem'], 'holdem screen rendered');
ok(fightsSeen > 0, 'reached at least one fight-intro/betting screen (' + fightsSeen + ')');
ok(volleySeen === 1, 'reached volleyball screen');
ok(seen['screen-fight-result'], 'reached fight-result screen');
ok(seen['screen-gameover'], 'reached game-over screen (a champion was crowned)');

// Sanity: seats were built and chips render.
var seats = doc.getElementById('seats');
ok(seats && seats.children.length === 5, 'five seats rendered (got ' + (seats ? seats.children.length : 0) + ')');

ok(raisesExercised > 0, 'holdem raise control exercised (' + raisesExercised + ')');
ok(allinsExercised > 0, 'holdem all-in path exercised (' + allinsExercised + ')');

console.log('   screens seen: ' + Object.keys(seen).join(', '));
console.log('   fights: ' + fightsSeen + ', bets placed by human: ' + betsPlaced +
  ', raises: ' + raisesExercised + ', allins: ' + allinsExercised + ', iterations: ' + iter);
console.log('\ndom smoke: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
