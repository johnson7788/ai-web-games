// Debug 2: sample chassis velocity + wheel raycast state right after R reset.
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };
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
page.on('pageerror', e => console.log('PAGEERROR', String(e)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
await sleep(4500);
await page.keyboard.press('Space'); await sleep(500);
await page.keyboard.down('w'); await sleep(2500); await page.keyboard.up('w'); await sleep(300);
// start in-page sampler at 30ms, then press R
await page.evaluate(() => {
  const car = window.__turboKart.simpleCar;
  const b = car.vehicle.chassisBody;
  window.__samples = [];
  const orig = car.resetPosition.bind(car);
  car.resetPosition = () => {
    orig();
    window.__samples.push({ ev: 'RESET', p: b.position.toArray().map(n => +n.toFixed(2)), v: b.velocity.toArray().map(n => +n.toFixed(2)), q: b.quaternion.toArray().map(n => +n.toFixed(3)) });
    let n = 0;
    const iv = setInterval(() => {
      try {
      n++;
      const wheels = car.vehicle.wheelInfos.map(w => ({ susp: +(w.suspensionLength || 0).toFixed(2), hit: w.raycastResult.hasHit, hitBody: w.raycastResult.body ? (w.raycastResult.body === window.__turboKart.world.floor.body ? 'ground' : 'other') : null, force: +(w.suspensionForce || 0).toFixed(1) }));
      window.__samples.push({ t: n * 30, p: b.position.toArray().map(x => +x.toFixed(2)), v: b.velocity.toArray().map(x => +x.toFixed(2)), av: b.angularVelocity.toArray().map(x => +x.toFixed(2)), wheels });
      if (n >= 30) clearInterval(iv);
      } catch (e) { window.__samples.push({ err: String(e && e.stack || e).slice(0, 300) }); clearInterval(iv); }
    }, 30);
  };
});
await page.keyboard.press('r');
await sleep(1300);
const samples = await page.evaluate(() => window.__samples);
for (const s of samples) console.log(JSON.stringify(s));
await browser.close(); srv.close();