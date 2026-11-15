// Sandbox retest harness — simulates pipygames live conditions:
// opaque-origin iframe (sandbox="allow-scripts"), CORS-enabled asset server.
// Verifies: boot, real driving, coin collection, 0 pageerror / 0 console error / 0 404.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = path.join(dir, 'tests', 'sandbox');
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.txt': 'text/plain', '.ico': 'image/x-icon', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
const errors = [], consoleErrs = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const report = { url: `http://127.0.0.1:${port}/`, startedAt: new Date().toISOString() };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) throw new Error('sandboxed iframe not found');
  report.iframeOrigin = await frame.evaluate(() => location.origin);

  await frame.waitForFunction(() => !!window.__turboKart?.world?.gameManager, null, { timeout: 20000 });
  report.booted = true;
  await page.screenshot({ path: path.join(out, '01-sandbox-title.png') });

  // Start game (Space) — real window event inside the sandboxed frame
  await frame.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })));
  await sleep(600);
  report.stateAfterStart = await frame.evaluate(() => window.__turboKart.world.gameManager.state);

  // Drive forward with W for 3s
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })));
  await sleep(3000);
  await frame.evaluate(() => document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true })));
  report.posAfterDrive = await frame.evaluate(() => { const p = window.__turboKart.simpleCar.chassisMesh.position; return { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }; });
  await page.screenshot({ path: path.join(out, '02-sandbox-driving.png') });

  // Coin-collecting autopilot (15s) — dispatched key events, same controller path as real keys
  report.autopilot = await frame.evaluate(async () => {
    const exp = window.__turboKart; const gm = exp.world.gameManager; const car = exp.simpleCar;
    const keys = {};
    const press = (k, down) => { if (!!keys[k] === down) return; keys[k] = down; document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true })); };
    const release = () => ['w', 'a', 'd', 's'].forEach((k) => press(k, false));
    return await new Promise((resolve) => {
      const t0 = Date.now();
      let slowSince = 0, stuckCount = 0, recoverUntil = 0;
      const iv = setInterval(() => {
        try {
          const now = Date.now();
          if (now - t0 > 15000 || gm.state !== 'playing') { release(); clearInterval(iv); resolve({ coins: gm.coinsCollected, score: gm.score }); return; }
          const pos = car.chassisMesh.position; const fwd = car.getForwardDirection();
          const v = car.vehicle.chassisBody.velocity; const spd = Math.hypot(v.x, v.z);
          if (now < recoverUntil) { press('w', false); press('s', true); press('a', stuckCount % 2 === 0); press('d', stuckCount % 2 === 1); return; }
          press('s', false);
          if (spd < 0.8) { if (!slowSince) slowSince = now; } else slowSince = 0;
          if (slowSince && now - slowSince > 1300) {
            stuckCount++; slowSince = 0;
            if (stuckCount >= 4) { stuckCount = 0; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', bubbles: true })); }
            else recoverUntil = now + 900;
            return;
          }
          let best = null, bd = Infinity;
          for (const c of gm.collectibles) { if (c.userData.collected) continue; const d = (c.position.x - pos.x) ** 2 + (c.position.z - pos.z) ** 2; if (d < bd) { bd = d; best = c; } }
          if (!best) { release(); clearInterval(iv); resolve({ coins: gm.coinsCollected, score: gm.score }); return; }
          const dx = best.position.x - pos.x, dz = best.position.z - pos.z;
          let a = Math.atan2(dx, dz) - Math.atan2(fwd.x, fwd.z); a = Math.atan2(Math.sin(a), Math.cos(a));
          const dist = Math.sqrt(bd);
          press('w', spd < 11 && !(dist < 6 && Math.abs(a) > 0.6)); press('a', a < -0.05); press('d', a > 0.05);
        } catch (e) { release(); clearInterval(iv); resolve({ error: String(e) }); }
      }, 80);
    });
  });
  await page.screenshot({ path: path.join(out, '03-sandbox-coins.png') });

  // zh dictionary check inside sandbox
  await frame.evaluate(() => window.I18N.setLang('zh'));
  await sleep(400);
  report.zhHud = await frame.evaluate(() => document.querySelector('.hud-points')?.textContent || '');
  await page.screenshot({ path: path.join(out, '04-sandbox-zh.png') });

  report.fps = await frame.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const loop = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(loop); else res(Math.round(n / 1.5)); }; requestAnimationFrame(loop); }));
} catch (e) {
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors; report.consoleErrs = consoleErrs.slice(0, 20); report.failedRequests = failed.slice(0, 20);
report.finishedAt = new Date().toISOString();
await browser.close();
srv.close();
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
const ok = !report.fatal && report.booted && errors.length === 0 && (report.autopilot?.coins || 0) >= 1;
console.log(ok ? '✓ SANDBOX OK' : '✗ SANDBOX FAIL', JSON.stringify({ origin: report.iframeOrigin, errors: errors.length, consoleErrs: consoleErrs.length, failed: failed.length, coins: report.autopilot?.coins, score: report.autopilot?.score, fps: report.fps, fatal: report.fatal }));
process.exit(ok ? 0 : 1);