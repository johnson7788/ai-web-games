// Endgame flow verification: defeat screen -> restart -> upgrade/sell -> victory screen -> back to title.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/malina';
const out = path.join(dir, 'tests/final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(dir, p);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.click('.solo-start');
  await sleep(6000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await sleep(750); }
  await page.evaluate(() => window.__malina.tutorial.setOff(true));

  // 1. defeat: the bush withers -> result screen
  await page.evaluate(() => window.__malina.sim.bush.hurt(99999, { x: 0, z: 0 }));
  await sleep(1200);
  const lost = await page.evaluate(() => ({ state: window.__malina.sim.state, text: document.querySelector('.pz-win h2')?.textContent || '', open: document.querySelector('.pz')?.classList.contains('open') }));
  if (lost.state !== 'lost' || !lost.open || !/withered/.test(lost.text)) throw new Error('defeat screen missing: ' + JSON.stringify(lost));
  console.log('✓ defeat screen', JSON.stringify(lost));
  await page.screenshot({ path: path.join(out, '10-defeat-screen.png') });

  // 2. restart -> fresh battle
  await page.click('.pz [data-act="restart"]');
  await sleep(1000);
  const fresh = await page.evaluate(() => { const td = window.__malina.td; return { state: td.state, wave: td.wave, towers: td.towers.length, berries: td.berries, bush: td.bush.hp }; });
  if (fresh.state !== 'play' || fresh.wave !== 0 || fresh.towers !== 0 || fresh.berries !== 300 || fresh.bush !== 400) throw new Error('restart failed: ' + JSON.stringify(fresh));
  console.log('✓ restart resets battle', JSON.stringify(fresh));

  // 3. upgrade + sell through the real pad-menu key handler
  await page.evaluate(() => { const m = window.__malina; const pad = m.td.pads[15]; m.hero.place(pad.pos.x + 1, pad.pos.z, 0, pad.pos.y); m.tdUi.openMenu(pad); });
  await sleep(400);
  await page.keyboard.press('1'); // build arrow (menu digit)
  await sleep(400);
  const built = await page.evaluate(() => window.__malina.td.towers.map(t => t.kind + ':' + t.level));
  if (built[0] !== 'arrow:1') throw new Error('build via menu key failed: ' + JSON.stringify(built));
  await page.evaluate(() => { const m = window.__malina; m.tdUi.openMenu(m.td.pads[15]); });
  await sleep(300);
  await page.keyboard.press('1'); // upgrade
  await sleep(400);
  const up = await page.evaluate(() => ({ lvl: window.__malina.td.towers[0]?.level, berries: window.__malina.td.berries }));
  if (up.lvl !== 2) throw new Error('upgrade failed: ' + JSON.stringify(up));
  console.log('✓ upgrade to II', JSON.stringify(up));
  await page.evaluate(() => { const m = window.__malina; m.tdUi.openMenu(m.td.pads[15]); });
  await sleep(300);
  await page.keyboard.press('2'); // sell
  await sleep(400);
  const sold = await page.evaluate(() => ({ towers: window.__malina.td.towers.length, berries: window.__malina.td.berries }));
  if (sold.towers !== 0 || sold.berries <= up.berries) throw new Error('sell failed: ' + JSON.stringify(sold));
  console.log('✓ sell refunds', JSON.stringify(sold));

  // 4. victory screen -> back to title
  await page.evaluate(() => { window.__malina.sim.state = 'won'; });
  await sleep(1200);
  const won = await page.evaluate(() => ({ text: document.querySelector('.pz-win h2')?.textContent || '', open: document.querySelector('.pz')?.classList.contains('open') }));
  if (!won.open || !/held/.test(won.text)) throw new Error('victory screen missing: ' + JSON.stringify(won));
  console.log('✓ victory screen', JSON.stringify(won));
  await page.screenshot({ path: path.join(out, '11-victory-screen.png') });
  await page.click('.pz [data-act="leave"]');
  await sleep(3000);
  const backTitle = await page.evaluate(() => !!document.querySelector('.solo-title'));
  if (!backTitle) throw new Error('back-to-title failed');
  console.log('✓ back to title');
  console.log(errors.length ? '✗ ERRORS ' + JSON.stringify(errors) : '✓ ENDGAME OK (0 pageerrors)');
  await browser.close();
  srv.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('✗ FATAL', e.message); process.exit(1); });