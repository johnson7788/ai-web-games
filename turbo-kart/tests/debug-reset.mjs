// Debug: verify R reset behavior with real Playwright keys.
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
// instrument resetPosition
await page.evaluate(() => {
  const car = window.__turboKart.simpleCar;
  const orig = car.resetPosition.bind(car);
  window.__resetLog = [];
  car.resetPosition = () => { window.__resetLog.push({ t: Date.now(), from: car.chassisMesh.position.toArray().map(n => +n.toFixed(2)) }); orig(); };
});
await page.keyboard.press('Space'); await sleep(500);
await page.keyboard.down('w'); await sleep(3000); await page.keyboard.up('w');
const before = await page.evaluate(() => window.__turboKart.simpleCar.chassisMesh.position.toArray().map(n => +n.toFixed(2)));
console.log('before R:', before);
await page.keyboard.press('r');
let prev = 0;
for (const ms of [100, 300, 800, 1500]) {
  await sleep(ms - prev); prev = ms;
  const p = await page.evaluate(() => ({ pos: window.__turboKart.simpleCar.chassisMesh.position.toArray().map(n => +n.toFixed(2)), resets: window.__resetLog, state: window.__turboKart.world.gameManager.state }));
  console.log(`t+${ms}:`, JSON.stringify(p));
}
await browser.close(); srv.close();