/*
 * Focused DOM test for the human-as-BETTOR path (buildHumanBetUI + _collectHumanBet +
 * fight-result payout rendering). The human plays passively (check/fold) so the
 * aggressive bots bust first, making the human a bettor when the fight starts.
 * Run: node test/test_dom_bettor.js   (requires jsdom)
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var JSDOM = require('jsdom').JSDOM;

var passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }

var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
['cards', 'handEvaluator', 'holdem', 'holdemAI', 'volleyball', 'economy', 'main'].forEach(function (name) {
  var src = fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8');
  html = html.replace('<script src="js/' + name + '.js"></script>', '<script>\n' + src + '\n</script>');
});

var errors = [];
var dom = new JSDOM(html, {
  runScripts: 'dangerously',
  beforeParse: function (win) {
    win.onerror = function (msg) { errors.push(String(msg)); };
    var ctxStub = new Proxy({}, {
      get: function (t, p) {
        if (p === 'createLinearGradient' || p === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
        if (p in t) return t[p];
        return function () {};
      },
      set: function (t, p, v) { t[p] = v; return true; }
    });
    win.HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
    win.__timerQ = []; win.__rafQ = [];
    win.setTimeout = function (cb) { win.__timerQ.push(cb); return win.__timerQ.length; };
    win.clearTimeout = function () {};
    win.requestAnimationFrame = function (cb) { win.__rafQ.push(cb); return win.__rafQ.length; };
    win.cancelAnimationFrame = function () { win.__rafQ.length = 0; };
  }
});
var win = dom.window, doc = win.document;
try { doc.dispatchEvent(new win.Event('DOMContentLoaded')); } catch (e) {}

function activeScreen() { var s = doc.querySelector('.screen.active'); return s ? s.id : null; }

doc.getElementById('btn-start').click();

var betUIShown = false, betPlaced = false, humanPayoutRendered = false;
var frame = 0, iter = 0, reachedResult = false;

while (iter++ < 600000) {
  var scr = activeScreen();
  if (scr === 'screen-gameover') break;

  if (scr === 'screen-holdem') {
    var btns = doc.getElementById('action-buttons');
    if (btns && btns.children.length > 0) {
      // Passive: check if possible, else fold (preserve chips).
      var chosen = null;
      for (var i = 0; i < btns.children.length; i++) {
        if (btns.children[i].textContent.indexOf('체크') === 0) chosen = btns.children[i];
      }
      if (!chosen) chosen = btns.children[0]; // fold
      chosen.click();
      continue;
    }
  }

  if (scr === 'screen-fight-intro') {
    var picks = doc.querySelectorAll('#bet-panel .bet-pick');
    if (picks.length > 0) {
      betUIShown = true;
      picks[0].click();
      var bs = doc.getElementById('bet-slider');
      if (bs && parseInt(bs.max, 10) > 0) {
        bs.value = Math.min(30, parseInt(bs.max, 10));
        bs.dispatchEvent(new win.Event('input'));
        if (parseInt(bs.value, 10) > 0) betPlaced = true;
      }
    }
    doc.getElementById('btn-fight-go').click();
    continue;
  }

  if (scr === 'screen-fight-result') {
    reachedResult = true;
    var body = doc.getElementById('fight-result-body').textContent;
    if (body.indexOf('⭐') >= 0) humanPayoutRendered = true; // human bettor payout line
    if (betUIShown) break; // got what we came for
    doc.getElementById('btn-fight-return').click();
    continue;
  }

  // pump queued work
  try {
    if (win.__timerQ.length) win.__timerQ.shift()();
    else if (win.__rafQ.length) { frame += 16; win.__rafQ.shift()(frame); }
    else break;
  } catch (e) { errors.push((e && e.stack) || String(e)); break; }
}

ok(errors.length === 0, 'no runtime errors (' + errors.length + ')' + (errors[0] ? '\n  ' + errors[0].split('\n').slice(0, 3).join('\n  ') : ''));
ok(reachedResult, 'reached a fight result');
ok(betUIShown, 'human bettor bet UI (buildHumanBetUI) was rendered');
ok(betPlaced, 'human placed a bet via the UI');
ok(humanPayoutRendered, 'human bet payout line rendered in fight result');

console.log('\ndom bettor: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
