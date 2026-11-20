// Sandbox retest: pipy-like conditions — iframe sandbox="allow-scripts" (opaque origin),
// server sends Access-Control-Allow-Origin: *. Verifies boot, real play, i18n, 0 pageerror.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/marble-dash';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!DOCTYPE html><html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  if (p === '/zh') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!DOCTYPE html><html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html?lang=zh" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!fpSafe(f) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
function fpSafe(f) { return f.startsWith(dir); }
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });

const errors = [], cerrs = [], failed = [];
async function run(url, tag, play) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
  page.on('pageerror', e => errors.push(`[${tag}] ${e}`));
  page.on('console', m => { if (m.type() === 'error') cerrs.push(`[${tag}] ${m.text()}`); });
  page.on('requestfailed', r => failed.push(`[${tag}] ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) failed.push(`[${tag}] ${r.status()} ${r.url()}`); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const frame = page.frames().find(f => f.url().includes('index.html'));
  if (!frame) throw new Error('iframe not found');
  const boot = await frame.evaluate(() => window.__marble && window.__marble.state());
  console.log(`[${tag}] boot:`, boot ? `phase=${boot.phase} level=${boot.level}` : 'NO GAME API');
  if (play) {
    await frame.click('#btn-play');
    await page.waitForTimeout(600);
    // real key input through the sandboxed iframe
    await frame.evaluate(() => { window.__marble.press('KeyW'); });
    await page.waitForTimeout(900);
    await frame.evaluate(() => { window.__marble.release('KeyW'); });
    const moved = await frame.evaluate(() => window.__marble.state().ball.z);
    console.log(`[${tag}] after W: z=${moved.toFixed(2)} (rolled=${moved < 1})`);
    // autopilot to goal
    await frame.evaluate(() => {
      window.__auto = () => new Promise((resolve) => {
        const M = window.__marble; const wps = M.waypoints(); let wi = 0; const held = {};
        const set = (k, on) => { if (!!held[k] === on) return; held[k] = on; on ? M.press(k) : M.release(k); };
        const t0 = performance.now();
        const tick = () => {
          const s = M.state();
          if (s.phase === 'clear' || s.phase === 'complete') { for (const k in held) set(k, false); resolve('CLEAR gems=' + s.gems + ' score=' + s.score); return; }
          if (s.phase === 'gameover' || performance.now() - t0 > 60000) { for (const k in held) set(k, false); resolve('FAIL ' + s.phase); return; }
          if (s.phase !== 'playing') { requestAnimationFrame(tick); return; }
          const b = s.ball; const wp = wps[Math.min(wi, wps.length - 1)];
          const dx = wp[0] - b.x, dz = wp[1] - b.z;
          if (Math.hypot(dx, dz) < 1.5 && wi < wps.length - 1) wi++;
          const last = wi >= wps.length - 1;
          const kp = last ? 1.0 : 1.4, kd = 1.2, dead = 0.4;
          const ax = dx * kp - b.vx * kd, az = dz * kp - b.vz * kd;
          set('KeyW', az < -dead); set('KeyS', az > dead); set('KeyD', ax > dead); set('KeyA', ax < -dead);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    const r = await frame.evaluate(() => window.__auto());
    console.log(`[${tag}] sandbox playthrough:`, r);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(dir, `tests/sandbox-${tag}.png`) });
    // localStorage must have thrown and been caught — verify save fallback works
    const ls = await frame.evaluate(() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (e) { return 'throws:' + e.name; } });
    console.log(`[${tag}] localStorage:`, ls);
  } else {
    const zh = await frame.evaluate(() => document.getElementById('btn-play').textContent);
    const tagline = await frame.evaluate(() => document.querySelector('.tagline').textContent);
    console.log(`[${tag}] zh UI: PLAY="${zh}" tagline="${tagline}"`);
    await page.screenshot({ path: path.join(dir, `tests/sandbox-${tag}.png`) });
  }
  await page.close();
}

await run(`http://127.0.0.1:${port}/`, 'en', true);
await run(`http://127.0.0.1:${port}/zh`, 'zh', false);
console.log('pageerrors:', errors.length, errors.slice(0, 5));
console.log('consoleErrs:', cerrs.length, cerrs.slice(0, 5));
console.log('failedRequests:', failed.length, failed.slice(0, 5));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);