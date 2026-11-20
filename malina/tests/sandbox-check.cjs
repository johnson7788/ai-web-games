// Sandbox retest: pipygames-like conditions — iframe sandbox="allow-scripts" (opaque origin),
// server sends Access-Control-Allow-Origin: * on everything. Verifies: init, real TD play, zh switch, 0 pageerror.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/malina';
const out = path.join(dir, 'tests/sandbox');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], cerr = [], failed = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  const report = { steps: [] };
  const ok = (name, data) => { report.steps.push({ name, ok: true, data }); console.log('✓', name, data ? JSON.stringify(data) : ''); };
  const frame = () => page.frames().find(f => f.url().includes('index.html'));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  let f = frame();
  if (!f) throw new Error('iframe not found');
  const origin = await f.evaluate(() => location.origin);
  ok('iframe-opaque-origin', { origin });
  const titleVisible = await f.evaluate(() => !!document.querySelector('.solo-title'));
  if (!titleVisible) throw new Error('title not visible in sandbox');
  await page.screenshot({ path: path.join(out, '01-sandbox-title.png') });
  ok('title-visible');

  // localStorage must throw in opaque origin — confirm the game survives it
  const storageThrows = await f.evaluate(() => { try { localStorage.setItem('x', '1'); return false; } catch { return true; } });
  ok('localStorage-blocked-as-expected', { storageThrows });

  await f.click('.solo-start');
  await sleep(6000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await sleep(750); }
  await f.evaluate(() => window.__malina.tutorial.setOff(true));
  const st = await f.evaluate(() => { const m = window.__malina; return { net: m.net, td: !!m.td, state: m.td.state, berries: m.td.berries, pads: m.td.pads.length }; });
  if (!st.td || st.net !== null) throw new Error('TD not local: ' + JSON.stringify(st));
  ok('battle-local-in-sandbox', st);

  // real play: walk to pad, build arrow tower, call wave
  await page.keyboard.down('w'); await sleep(1150); await page.keyboard.up('w');
  await page.keyboard.down('a'); await sleep(620); await page.keyboard.up('a');
  await sleep(400);
  await page.keyboard.press('f'); await sleep(400);
  await page.keyboard.press('1'); await sleep(600);
  const built = await f.evaluate(() => window.__malina.td.towers.map(t => t.kind));
  if (built[0] !== 'arrow') throw new Error('tower not built in sandbox: ' + JSON.stringify(built));
  ok('tower-built-in-sandbox', { built });
  await page.keyboard.press('g'); await sleep(800);
  const waveOn = await f.evaluate(() => ({ wave: window.__malina.td.wave, running: window.__malina.td.waveRunning }));
  if (waveOn.wave !== 1 || !waveOn.running) throw new Error('wave not started: ' + JSON.stringify(waveOn));
  ok('wave-started-in-sandbox', waveOn);
  await sleep(22000);
  const combat = await f.evaluate(() => ({ fallen: window.__malina.td.fallen, spawned: window.__malina.td.spawned, bush: window.__malina.td.bush.hp, towers: window.__malina.td.towers.length }));
  if (combat.fallen < 1) throw new Error('no kills in sandbox: ' + JSON.stringify(combat));
  ok('towers-kill-enemies-in-sandbox', combat);
  await page.screenshot({ path: path.join(out, '02-sandbox-combat.png') });

  // language switch under sandbox: kit button reloads with ?lang=zh (storage is blocked)
  await f.click('#pipy-lang-btn');
  await sleep(4000);
  f = frame();
  const zhUrl = f.url();
  const zhTitle = await f.evaluate(() => document.querySelector('.solo-start')?.textContent || '');
  if (!zhUrl.includes('lang=zh') || !zhTitle.includes('开始防守')) throw new Error('zh switch failed: ' + zhUrl + ' / ' + zhTitle);
  ok('zh-switch-in-sandbox', { url: zhUrl, button: zhTitle.trim() });
  await page.screenshot({ path: path.join(out, '03-sandbox-zh-title.png') });
  await f.click('.solo-start');
  await sleep(6000);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await sleep(750); }
  const zhHud = await f.evaluate(() => ({ wave: document.querySelector('.td-wave')?.textContent || '', bush: document.querySelector('.td-bush-t')?.textContent || '', goal: document.querySelector('.hud-goal b')?.textContent || '' }));
  if (!/第/.test(zhHud.wave) || !/覆盆子灌木/.test(zhHud.bush)) throw new Error('zh HUD not translated: ' + JSON.stringify(zhHud));
  ok('zh-hud-in-sandbox', zhHud);
  await page.screenshot({ path: path.join(out, '04-sandbox-zh-hud.png') });

  report.errors = errors; report.consoleErrs = cerr; report.failedRequests = failed;
  fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
  const bad = errors.length > 0;
  console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify({ errors: errors.length, consoleErrs: cerr.length, failed: failed.length }));
  if (cerr.length) console.log('console:', JSON.stringify(cerr));
  if (failed.length) console.log('failed:', JSON.stringify(failed));
  await browser.close();
  srv.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('✗ SANDBOX FATAL', e.message); process.exit(1); });