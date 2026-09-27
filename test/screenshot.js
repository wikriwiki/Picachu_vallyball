// 브라우저 E2E: 서버 실행 → 페이지 2개(방장/친구) + CPU 1명으로 실제 UI 조작, 스크린샷 저장, 콘솔 에러 수집
// 실행: node test/screenshot.js  (PLAYWRIGHT_PATH 로 playwright 모듈 경로 지정 가능)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { startServer } from '../server/index.js';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const MODE = process.env.MODE || 'full';
const LIMIT = Number(process.env.LIMIT_MS || 600000);

const { server } = await startServer(0, { delayScale: 0.25, turnTimeout: 60000, disconnectedDelay: 2000 });
const base = `http://localhost:${server.address().port}/`;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function page(name, w = 1400, h = 860) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_CERT_AUTHORITY_INVALID/.test(m.text())) errors.push(`[${name}] ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  await p.goto(base);
  return p;
}
const host = await page('host');
await host.waitForSelector('#conn-status.ok');
await host.fill('#inp-name', '방장');
await host.selectOption('#sel-mode', MODE);
await host.screenshot({ path: OUT + '01-title.png' });
await host.click('#btn-create');
await host.waitForSelector('#screen-lobby.active');
const code = (await host.textContent('#room-code')).trim();
const friend = await page('friend', 900, 700);
await friend.waitForSelector('#conn-status.ok');
await friend.fill('#inp-name', '친구');
await friend.click('.sw >> nth=12');
await friend.fill('#inp-code', code);
await friend.click('#btn-join');
await friend.waitForSelector('#screen-lobby.active');
await host.click('#btn-cpu');
await host.waitForFunction(() => document.querySelectorAll('.member:not(.empty)').length === 3);
await host.screenshot({ path: OUT + '02-lobby.png' });
await host.click('#btn-start');
await host.waitForSelector('#screen-game.active', { timeout: 30000 });
await sleep(2500);
await host.screenshot({ path: OUT + '03-game.png' });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function drive(p) {
  // 내 차례면 조작
  const st = await p.evaluate(() => {
    const a = window.__app;
    if (!a || !a.state) return null;
    const s = a.state;
    return { phase: s.phase, era: s.era, busy: a.busy || a.queue.length > 0, mine: !!(s.pending && s.pending.playerId === a.me && a.sentSeq !== s.seq), type: s.pending && s.pending.type };
  });
  if (!st) return null;
  if (!st.busy && st.mine) {
    if (st.type === 'spin') {
      const cards = await p.$$('.card:not(.disabled)');
      if (cards.length && Math.random() < 0.3) {
        await cards[0].click();
        if (await p.isVisible('#modal-number')) await p.click('#num-grid button >> nth=5');
        await sleep(300);
      } else {
        const btn = await p.$('#btn-spin:not([disabled])');
        if (btn) {
          const box = await btn.boundingBox();
          await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await p.mouse.down();
          await sleep(200 + Math.random() * 600);
          await p.mouse.up();
        }
      }
    } else if (st.type === 'choice') {
      const opts = await p.$$('#choice-list .opt:not([disabled])');
      if (opts.length) await opts[Math.floor(Math.random() * opts.length)].click();
    }
  }
  return st;
}

const t0 = Date.now();
const shotEra = new Set();
let last = null;
while (Date.now() - t0 < LIMIT) {
  const a = await drive(host);
  await drive(friend);
  if (a) {
    last = a;
    if (!shotEra.has(a.era)) { shotEra.add(a.era); await sleep(3500); await host.screenshot({ path: OUT + `10-era${a.era}.png` }); }
    if (a.phase === 'ended') break;
  }
  await sleep(250);
}
await host.waitForSelector('#modal-result:not(.hidden)', { timeout: 30000 }).catch(() => {});
await sleep(12000);
await host.screenshot({ path: OUT + '90-result.png' });
await friend.screenshot({ path: OUT + '91-result-friend.png' });
console.log('final phase', last && last.phase, 'elapsed', Math.round((Date.now() - t0) / 1000) + 's');
console.log('errors:', errors.length ? '\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'none');
await browser.close();
server.close();
process.exit(last && last.phase === 'ended' && !errors.some((e) => /pageerror|error:/.test(e)) ? 0 : 1);
