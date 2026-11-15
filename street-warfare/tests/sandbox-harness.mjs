// Sandbox re-test harness — simulates the pipygames portal iframe:
//   sandbox="allow-scripts" (opaque origin: no pointer lock, no localStorage,
//   cross-origin images) served with Access-Control-Allow-Origin: *.
// Verifies: boot, DEPLOY, fallback aim + fire + WASD, pause/resume, KIA→respawn,
// 0 pageerror / 0 console error / 0 failed requests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = path.join(dir, 'tests/sandbox');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.ico': 'image/x-icon' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    s.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0;display:block"></iframe>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cerr = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const log = (...a) => console.log('[sandbox]', ...a);
await page.goto(url, { waitUntil: 'domcontentloaded' });
const handle = await page.waitForSelector('iframe', { timeout: 15000 });
const frame = await handle.contentFrame();
if (!frame) throw new Error('iframe not found');

// opaque origin sanity
const origin = await frame.evaluate(() => window.origin);
log('iframe origin:', origin);

await frame.waitForFunction(() => window.__READY__ === true && document.getElementById('sw-deploy') && !document.getElementById('sw-deploy').disabled, null, { timeout: 90000 });
log('boot ready');
await page.screenshot({ path: path.join(out, '01-title.png') });

await frame.click('#sw-deploy');
await page.waitForTimeout(1500);
const inputState = await frame.evaluate(() => {
  const i = window.__ENGINE__.input;
  return { locked: i.pointerLocked, blocked: i.lockBlocked, fallback: i.fallbackAim, origin: window.origin };
});
log('input:', JSON.stringify(inputState));
if (inputState.locked) throw new Error('pointer lock unexpectedly acquired in sandbox');
if (!inputState.fallback) throw new Error('fallback aim not active in sandbox');

const t0 = await frame.evaluate(() => {
  const e = window.__ENGINE__; const p = e.ctx.peek('player');
  return { x: p.position.x, z: p.position.z, yaw: p.movement.yaw, fired: e.ctx.peek('weapons').stats.fired };
});

// real input: aim sweeps + fire bursts + WASD (all through the fallback path)
await page.mouse.move(640, 360);
for (const [x1, x2] of [[600, 700], [700, 620], [640, 690]]) {
  await page.mouse.move(x1, 360);
  await page.mouse.down();
  await page.mouse.move(x2, 355, { steps: 6 });
  await page.waitForTimeout(350);
  await page.mouse.up();
  await page.waitForTimeout(150);
}
await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
await page.keyboard.down('a'); await page.waitForTimeout(500); await page.keyboard.up('a');
await page.keyboard.press('r');
await page.waitForTimeout(2400);

const play = await frame.evaluate((t0) => {
  const e = window.__ENGINE__; const p = e.ctx.peek('player'); const w = e.ctx.peek('weapons');
  const d = e.ctx.get('director'); const ai = e.ctx.peek('ai');
  return {
    shots: w.stats.fired - t0.fired,
    dist: +Math.hypot(p.position.x - t0.x, p.position.z - t0.z).toFixed(2),
    dyaw: +Math.abs(p.movement.yaw - t0.yaw).toFixed(3),
    health: p.health.value, state: d.state, alive: ai.stats.alive,
    audio: window.__AUDIO__?.running ?? false,
    matchText: document.querySelector('.ow-match')?.textContent ?? '',
  };
}, t0);
log('play:', JSON.stringify(play));
if (play.shots <= 0) throw new Error('sandbox: no shots fired');
if (play.dist < 0.5) throw new Error('sandbox: player did not move');
if (play.dyaw < 0.01) throw new Error('sandbox: fallback aim did not turn the camera');
await page.screenshot({ path: path.join(out, '02-play.png') });

// pause / resume inside the sandbox (wait out any KIA countdown first)
await frame.waitForFunction(() => window.__ENGINE__?.ctx.get('director').state === 'play', null, { timeout: 15000 });
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const paused = await frame.evaluate(() => window.__ENGINE__.ctx.get('ui').menu.open);
if (!paused) throw new Error('sandbox: pause menu did not open');
await page.screenshot({ path: path.join(out, '03-pause.png') });
await frame.click('.ow-btn.primary');
await page.waitForTimeout(600);
const resumed = await frame.evaluate(() => window.__ENGINE__.ctx.get('ui').menu.open === false && window.__ENGINE__.ctx.get('director').state === 'play');
if (!resumed) throw new Error('sandbox: resume failed');

// KIA → redeploy loop. Capture health synchronously at the respawn instant
// (enemies may legitimately hit the player again right after redeploying).
await frame.evaluate(() => {
  const e = window.__ENGINE__;
  const d = e.ctx.get('director');
  window.__RESPAWN_HP__ = null;
  const orig = d._respawn.bind(d);
  d._respawn = () => { orig(); window.__RESPAWN_HP__ = e.ctx.peek('player').health.value; };
});
await frame.evaluate(() => { const hp = window.__ENGINE__.ctx.peek('player').health; hp.spawnProtectUntil = -1; window.__ENGINE__.ctx.peek('player').applyDamage(500, null); });
await page.waitForTimeout(800);
const kia = await frame.evaluate(() => window.__ENGINE__.ctx.get('director').state);
if (kia !== 'kia') throw new Error('sandbox: KIA state not entered');
await page.screenshot({ path: path.join(out, '04-kia.png') });
await frame.waitForFunction(() => window.__RESPAWN_HP__ !== null, null, { timeout: 10000 });
const back = await frame.evaluate(() => ({
  respawnHealth: window.__RESPAWN_HP__,
  state: window.__ENGINE__.ctx.get('director').state,
}));
if (back.respawnHealth < 99 || back.state !== 'play') throw new Error('sandbox: respawn failed ' + JSON.stringify(back));
log('respawn ok:', JSON.stringify(back));

// fire again after respawn to prove the loop continues (retry if the fresh
// spawn is immediately contested and the player goes down mid-burst)
const firedBefore = await frame.evaluate(() => window.__ENGINE__.ctx.peek('weapons').stats.fired);
let firedAfter = firedBefore;
for (let attempt = 0; attempt < 3 && firedAfter <= firedBefore; attempt++) {
  await frame.waitForFunction(() => window.__ENGINE__.ctx.get('director').state === 'play', null, { timeout: 12000 });
  await page.mouse.move(640, 360);
  await page.mouse.down(); await page.mouse.move(680, 358, { steps: 4 }); await page.waitForTimeout(300); await page.mouse.up();
  firedAfter = await frame.evaluate(() => window.__ENGINE__.ctx.peek('weapons').stats.fired);
}
if (firedAfter <= firedBefore) throw new Error('sandbox: cannot fire after respawn');
await page.screenshot({ path: path.join(out, '05-after-respawn.png') });

const report = { url, origin, inputState, play, kiaRespawn: back, errors, consoleErrs: cerr, failed, finishedAt: new Date().toISOString() };
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
log('errors:', errors.length, 'consoleErrs:', cerr.length, 'failed:', failed.length);
if (errors.length || cerr.length || failed.length) log(JSON.stringify({ errors, cerr, failed }, null, 1));
await browser.close();
srv.close();
process.exit(errors.length || cerr.length || failed.length ? 1 : 0);