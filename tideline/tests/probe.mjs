// quick runtime probe: load, start, drive, report state + errors
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = '/Users/admin/git/webgames/games/tideline';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(dir, p);
  if (!fp.startsWith(dir) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cerr = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__tideline && window.__tideline.state.mode === 'title', { timeout: 120000 });
console.log('load ms:', Date.now() - t0);
console.log('state:', JSON.stringify(await page.evaluate(() => window.__tideline.state)));
await page.screenshot({ path: dir + '/tests/probe-title.png' });
await page.click('#btnStart');
await page.waitForTimeout(4500);
console.log('after start:', JSON.stringify(await page.evaluate(() => window.__tideline.state)));
// drive forward
await page.keyboard.down('KeyW');
await page.waitForTimeout(8000);
console.log('after 8s gas:', JSON.stringify(await page.evaluate(() => window.__tideline.state)));
await page.screenshot({ path: dir + '/tests/probe-drive.png' });
// autopilot for 40s
await page.evaluate(() => window.__tideline.autopilot(true));
await page.waitForTimeout(40000);
console.log('after autopilot 40s:', JSON.stringify(await page.evaluate(() => window.__tideline.state)));
await page.screenshot({ path: dir + '/tests/probe-auto.png' });
await page.evaluate(() => window.__tideline.autopilot(false));
await page.keyboard.up('KeyW');
console.log('errors:', errors, 'consoleErrs:', cerr);
await browser.close();
server.close();