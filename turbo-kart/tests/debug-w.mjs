// Focused: hold W, snapshot every 250ms; then A; check for pin/explosion
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
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = (k, down) => page.evaluate(([k, down]) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true })), [k, down]);
const snap = () => page.evaluate(() => {
  const e = window.__turboKart, car = e.simpleCar;
  const p = car.chassisMesh.position, f = car.getForwardDirection(), v = car.vehicle.chassisBody.velocity;
  const c = e.world.simpleCarController;
  return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), hdg: +Math.atan2(f.x, f.z).toFixed(2), spd: +Math.hypot(v.x, v.z).toFixed(1), held: [...c.heldKeys].join(''), wf: car.vehicle.wheelForces ? car.vehicle.wheelForces.map(v => +v.toFixed(0)).join('/') : '?', fps: +e.time.delta.toFixed(0) };
});
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })));
await sleep(400);
await key('w', true);
for (let i = 0; i < 12; i++) { await sleep(250); console.log(`W+${(i + 1) * 250}ms:`, JSON.stringify(await snap())); }
await key('a', true);
for (let i = 0; i < 6; i++) { await sleep(250); console.log(`A+${(i + 1) * 250}ms:`, JSON.stringify(await snap())); }
await key('a', false); await key('w', false);
await browser.close(); srv.close();