// Sandbox retest: pipy-like iframe sandbox="allow-scripts" (opaque origin) + ACAO:* server.
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
  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const fp = path.join(dir, p);
  if (!fp.startsWith(dir) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cerr = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
let frame = null;
for (let i = 0; i < 40 && !frame; i++) {
  frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) await page.waitForTimeout(250);
}
if (!frame) { console.log('NO IFRAME'); process.exit(1); }
async function waitState(modes, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const m = await frame.evaluate(() => window.__tideline && window.__tideline.state.mode).catch(() => null);
    if (m && modes.includes(m)) return m;
    await page.waitForTimeout(400);
  }
  throw new Error('waitState timeout: ' + modes.join('|'));
}
await waitState(['title'], 120000);
console.log('sandbox: title reached, origin =', await frame.evaluate(() => location.origin));
await frame.click('#btnStart');
await waitState(['racing'], 30000);
await frame.evaluate(() => window.__tideline.autopilot(true));
await page.waitForTimeout(25000);
const s = await frame.evaluate(() => window.__tideline.state);
console.log('sandbox state:', JSON.stringify({ mode: s.mode, gates: s.gatesPassedTotal, cp: s.cp, fps: s.fps, speed: s.speed.toFixed(1) }));
await page.screenshot({ path: dir + '/tests/sandbox-drive.png' });
await frame.evaluate(() => window.__tideline.autopilot(false));
const ok = errors.length === 0 && s.gatesPassedTotal >= 1 && s.mode === 'racing';
console.log('sandbox errors:', errors, 'consoleErrs:', cerr, 'failed:', failed);
console.log(ok ? 'SANDBOX OK' : 'SANDBOX FAIL');
await browser.close();
server.close();
process.exit(ok ? 0 : 1);