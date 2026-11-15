// Menu panels check: Records wall, Controls panel, locked Chaos difficulty card — English rendering.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = path.resolve(import.meta.dirname, '..');
const out = import.meta.dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(dir, p === '/' ? 'index.html' : p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
const report = {};
const key = async (k, ms) => { await page.keyboard.press(k); await sleep(ms); };
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(7000);
  await key('Enter', 700);                       // wake
  await key('ArrowDown', 250); await key('ArrowDown', 250);
  await key('Enter', 900);                       // Records
  report.records = await page.evaluate(() => document.querySelector('.t-rec h2')?.textContent);
  report.recordsUnlock = await page.evaluate(() => document.querySelector('.t-rec li span')?.textContent);
  await page.screenshot({ path: path.join(out, 'menu-records.png') });
  await key('Escape', 600);
  await key('ArrowDown', 250);
  await key('Enter', 900);                       // Controls
  report.controls = await page.evaluate(() => document.querySelector('.t-ctl h2')?.textContent);
  report.credit = await page.evaluate(() => document.querySelector('.t-credit')?.textContent?.slice(0, 80));
  await page.screenshot({ path: path.join(out, 'menu-controls.png') });
  await key('Escape', 600);
  await key('ArrowUp', 250); await key('ArrowUp', 250); await key('ArrowUp', 250);
  await key('Enter', 900);                       // Story panel
  await key('Enter', 900);                       // chapter I → difficulty
  await key('ArrowDown', 250); await key('ArrowDown', 250);   // Normal → Hard → Chaos (locked)
  report.chaosLine = await page.evaluate(() => document.querySelector('.t-dline b')?.textContent);
  await page.screenshot({ path: path.join(out, 'menu-chaos.png') });
} catch (e) { report.fatal = String(e.message || e).split('\n')[0]; }
report.errors = errors;
fs.writeFileSync(path.join(out, 'menu-report.json'), JSON.stringify(report, null, 2));
await browser.close(); srv.close();
console.log(JSON.stringify(report, null, 1));
process.exit(report.fatal || errors.length ? 1 : 0);