// Debug: steering sign + autopilot telemetry
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.txt': 'text/plain' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(dir, p);
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (k, down) => page.evaluate(([k, down]) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true })), [k, down]);
const snap = () => page.evaluate(() => {
  const e = window.__turboKart, car = e.simpleCar, gm = e.world.gameManager;
  const p = car.chassisMesh.position, f = car.getForwardDirection(), v = car.vehicle.chassisBody.velocity;
  let best = null, bd = 1e9;
  for (const c of gm.collectibles) { if (c.userData.collected) continue; const d = Math.hypot(c.position.x - p.x, c.position.z - p.z); if (d < bd) { bd = d; best = c; } }
  return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), hdg: +Math.atan2(f.x, f.z).toFixed(2), spd: +Math.hypot(v.x, v.z).toFixed(1), coins: gm.coinsCollected, score: gm.score, near: +bd.toFixed(1), state: gm.state, lap: gm.currentLap };
});
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })));
await sleep(400);
console.log('start:', JSON.stringify(await snap()));
await key('w', true); await sleep(1500);
console.log('after W 1.5s:', JSON.stringify(await snap()));
await key('a', true); await sleep(500); await key('a', false);
console.log('after A 0.5s (expect hdg DECREASE if A=left):', JSON.stringify(await snap()));
await key('d', true); await sleep(500); await key('d', false);
console.log('after D 0.5s:', JSON.stringify(await snap()));
await key('w', false);
// autopilot with telemetry
await page.evaluate(() => {
  const exp = window.__turboKart; const gm = exp.world.gameManager; const car = exp.simpleCar;
  const keys = {};
  const press = (k, down) => { if (!!keys[k] === down) return; keys[k] = down; document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true })); };
  window.__log = [];
  const t0 = Date.now();
  const iv = setInterval(() => {
    if (Date.now() - t0 > 25000 || gm.state !== 'playing') { ['w','a','d','s'].forEach(k => press(k, false)); clearInterval(iv); return; }
    const pos = car.chassisMesh.position; const fwd = car.getForwardDirection();
    let best = null, bd = Infinity;
    for (const c of gm.collectibles) { if (c.userData.collected) continue; const d = (c.position.x - pos.x) ** 2 + (c.position.z - pos.z) ** 2; if (d < bd) { bd = d; best = c; } }
    if (!best) { ['w','a','d'].forEach(k => press(k, false)); clearInterval(iv); return; }
    const dx = best.position.x - pos.x, dz = best.position.z - pos.z;
    let a = Math.atan2(dx, dz) - Math.atan2(fwd.x, fwd.z); a = Math.atan2(Math.sin(a), Math.cos(a));
    const dist = Math.sqrt(bd);
    press('w', !(dist < 6 && Math.abs(a) > 0.6)); press('a', a < -0.05); press('d', a > 0.05);
    if (Date.now() - t0 > (window.__log.length + 1) * 2000) {
      const v = car.vehicle.chassisBody.velocity;
      window.__log.push({ t: Date.now() - t0, x: +pos.x.toFixed(1), z: +pos.z.toFixed(1), y: +pos.y.toFixed(1), hdg: +Math.atan2(fwd.x, fwd.z).toFixed(2), err: +a.toFixed(2), dist: +dist.toFixed(1), spd: +Math.hypot(v.x, v.z).toFixed(1), coins: gm.coinsCollected });
    }
  }, 80);
});
await sleep(26000);
console.log('telemetry:', JSON.stringify(await page.evaluate(() => window.__log), null, 1));
console.log('final:', JSON.stringify(await snap()));
await browser.close(); srv.close();