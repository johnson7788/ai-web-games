// full-loop probe: win screen, best-time save, restart, fail screen, retry.
// SW=1 forces SwiftShader; LANG=zh loads Chinese UI.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = '/Users/admin/git/webgames/games/tideline';
const SW = process.env.SW === '1';
const LANG = process.env.LANG || 'en';
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

const args = SW
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server']
  : ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'];
const browser = await chromium.launch({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cerr = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
const tag = SW ? 'sw' : 'hw';
async function waitState(modes, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const m = await page.evaluate(() => window.__tideline.state.mode);
    if (modes.includes(m)) return m;
    await page.waitForTimeout(400);
  }
  throw new Error('waitState timeout: ' + modes.join('|') + ' last=' + await page.evaluate(() => window.__tideline.state.mode));
}
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/?lang=${LANG}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__tideline && window.__tideline.state.mode === 'title', { timeout: 180000 });
console.log(`[${tag}] load ms:`, Date.now() - t0);
await page.screenshot({ path: `${dir}/tests/p2-${tag}-title.png` });

await page.click('#btnStart');
await page.waitForTimeout(5000);
console.log('post-click state:', JSON.stringify(await page.evaluate(() => window.__tideline.state)), 'errs:', errors, 'cerr:', cerr);
await waitState(['racing'], 30000);
await page.evaluate(() => window.__tideline.autopilot(true));

if (SW) {
  // software: just prove it renders + drives + passes gates
  await page.waitForTimeout(45000);
  const s = await page.evaluate(() => window.__tideline.state);
  console.log(`[${tag}] after 45s:`, JSON.stringify({ mode: s.mode, cp: s.cp, gates: s.gatesPassedTotal, fps: s.fps, speed: s.speed.toFixed(1), quality: s.quality }));
  await page.screenshot({ path: `${dir}/tests/p2-${tag}-drive.png` });
} else {
  // hardware: full race to the win screen
  await waitState(['finished','failed'], 420000);
  let s = await page.evaluate(() => window.__tideline.state);
  console.log('[hw] race end:', JSON.stringify({ mode: s.mode, lap: s.lap, gates: s.gatesPassedTotal, time: s.raceTime.toFixed(1), fps: s.fps }));
  await page.screenshot({ path: `${dir}/tests/p2-hw-finish.png` });
  const best = await page.evaluate(() => window.PipySDK.load('best', null));
  console.log('[hw] saved best:', best);

  // restart with R, then idle to the fail screen
  await page.evaluate(() => window.__tideline.autopilot(false));
  await page.keyboard.press('KeyR');
  await waitState(['racing'], 30000);
  console.log('[hw] restarted OK');
  await waitState(['failed'], 90000);
  await page.screenshot({ path: `${dir}/tests/p2-hw-fail.png` });
  console.log('[hw] fail screen OK');
  await page.click('#btnRetry');
  await waitState(['racing'], 30000);
  console.log('[hw] retry OK');
  // pause / resume
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const paused = await page.evaluate(() => window.__tideline.state.mode);
  await page.click('#btnResume');
  await page.waitForTimeout(300);
  const resumed = await page.evaluate(() => window.__tideline.state.mode);
  console.log('[hw] pause/resume:', paused, resumed);
  await page.evaluate(() => window.__tideline.autopilot(true));
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${dir}/tests/p2-hw-drive.png` });
}
console.log(`[${tag}] errors:`, errors, 'consoleErrs:', cerr);
await browser.close();
server.close();