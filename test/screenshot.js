/*
 * Visual capture via headless Chrome. Plays the real game with shortened
 * timers and screenshots each screen. Output PNGs in test/shots/.
 * Run: node test/screenshot.js
 */
var path = require('path');
var fs = require('fs');
var puppeteer = require('puppeteer');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(__dirname, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
var fileUrl = 'file://' + path.join(ROOT, 'index.html');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 1 });

  // Speed up: clamp setTimeout delays so AI/hand transitions run fast.
  await page.evaluateOnNewDocument(function () {
    var realSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (cb, ms) {
      return realSetTimeout(cb, Math.min(ms || 0, 300));
    };
  });

  var errors = [];
  page.on('pageerror', function (e) { errors.push(String(e)); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(fileUrl, { waitUntil: 'load' });
  await sleep(200);
  await page.screenshot({ path: path.join(OUT, '1-menu.png') });
  console.log('captured menu');

  await page.click('#btn-start');
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '2-holdem.png') });
  console.log('captured holdem');

  var shots = { 'screen-fight-intro': false, 'screen-volley': false, 'screen-fight-result': false, 'screen-gameover': false };
  var labels = { 'screen-fight-intro': '3-fight-intro', 'screen-volley': '4-volley', 'screen-fight-result': '5-fight-result', 'screen-gameover': '6-gameover' };

  var showdownCaptured = false;
  var deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    var scr = await page.evaluate(function () {
      var s = document.querySelector('.screen.active');
      return s ? s.id : null;
    });

    // Capture a showdown overlay if one is visible.
    if (!showdownCaptured) {
      var sdShown = await page.evaluate(function () {
        var o = document.getElementById('showdown-overlay');
        return o && o.classList.contains('show') &&
          document.getElementById('showdown-title').textContent.indexOf('쇼다운') >= 0;
      });
      if (sdShown) {
        await page.screenshot({ path: path.join(OUT, '2b-showdown.png') });
        showdownCaptured = true;
        console.log('captured showdown');
      }
    }

    if (scr === 'screen-volley' && !shots[scr]) {
      await sleep(1600); // let a rally develop
      await page.screenshot({ path: path.join(OUT, labels[scr] + '.png') });
      shots[scr] = true;
      console.log('captured volley');
      continue;
    }
    if (scr && shots.hasOwnProperty(scr) && !shots[scr]) {
      await sleep(250);
      await page.screenshot({ path: path.join(OUT, labels[scr] + '.png') });
      shots[scr] = true;
      console.log('captured ' + scr);
    }

    if (scr === 'screen-gameover') break;

    // Drive the game.
    await page.evaluate(function () {
      var scrEl = document.querySelector('.screen.active');
      var id = scrEl ? scrEl.id : null;
      if (id === 'screen-holdem') {
        var btns = document.getElementById('action-buttons');
        if (btns && btns.children.length) {
          // check if possible, else call (to reach flops/showdowns)
          var pick = null;
          for (var i = 0; i < btns.children.length; i++) {
            if (btns.children[i].textContent.indexOf('체크') === 0) pick = btns.children[i];
          }
          if (!pick) for (var j = 0; j < btns.children.length; j++) {
            if (btns.children[j].textContent.indexOf('콜') === 0) pick = btns.children[j];
          }
          (pick || btns.children[0]).click();
        }
      } else if (id === 'screen-fight-intro') {
        var picks = document.querySelectorAll('#bet-panel .bet-pick');
        if (picks.length) {
          picks[0].click();
          var bs = document.getElementById('bet-slider');
          if (bs) { bs.value = Math.min(40, parseInt(bs.max, 10) || 0); bs.dispatchEvent(new Event('input')); }
        }
      } else if (id === 'screen-fight-result') {
        var rb = document.getElementById('btn-fight-return'); if (rb) rb.click();
      }
    });

    // After capturing fight-intro, proceed to the match.
    if (scr === 'screen-fight-intro' && shots['screen-fight-intro']) {
      await page.evaluate(function () { var g = document.getElementById('btn-fight-go'); if (g) g.click(); });
    }
    await sleep(60);
  }

  console.log('shots done. errors: ' + errors.length);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  await browser.close();
  process.exit(0);
})();
