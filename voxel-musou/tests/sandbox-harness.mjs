// Sandbox retest: serves the game with Access-Control-Allow-Origin: * and boots it inside
// <iframe sandbox="allow-scripts"> (opaque origin — the pipygames production condition).
// Verifies: init, real combat (move + attack + KOs), pointer-lock refusal fallback, language switch, 0 pageerrors.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = import.meta.dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    s.end('<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts" src="/index.html?go=free&char=zhaoyun&map=hulao" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1300, height: 760 } });
const errors = [], consoleErrs = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on('crash', () => errors.push('PAGE CRASH'));
const report = { condition: 'iframe sandbox="allow-scripts" (opaque origin), ACAO:*', url: `http://127.0.0.1:${port}/` };
try {
  await page.goto(report.url, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) throw new Error('game iframe not found');
  report.origin = await frame.evaluate(() => location.origin);
  report.battleReached = await frame.evaluate(() => !document.getElementById('hud').hidden);
  if (!report.battleReached) throw new Error('battle not reached in sandbox');
  // pointer lock must be refused by the sandbox; the game must degrade (clicks attack, Q/E orbit)
  report.pointerLockRefused = await frame.evaluate(() => document.pointerLockElement === null);
  await frame.click('#c'); await sleep(300);           // first click: refused lock request -> noLock fallback
  await frame.click('#c'); await sleep(200);           // second click: attacks
  await page.keyboard.down('w'); await sleep(2500); await page.keyboard.up('w');
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < 4; i++) { await page.keyboard.press('j'); await sleep(130); }
    await page.keyboard.press('k'); await sleep(500);
    if (round === 1) { await page.keyboard.down('w'); await sleep(700); await page.keyboard.up('w'); }
  }
  await page.keyboard.press('i'); await sleep(900);
  report.kos = await frame.evaluate(() => +(document.querySelector('.h-ko .num b span')?.textContent || 0));
  report.hudName = await frame.evaluate(() => document.querySelector('.h-player .name')?.textContent);
  await page.screenshot({ path: path.join(out, 'sandbox-battle.png') });
  if (!(report.kos > 0)) throw new Error('no KOs in sandbox — core loop failed');
  // mouse-click attacks must work without pointer lock (the sandbox fallback): let the ring re-close, then click
  await sleep(1800);
  const kosBeforeClicks = report.kos;
  for (let i = 0; i < 10; i++) { await frame.click('#c'); await sleep(200); }
  report.kosAfterClicks = await frame.evaluate(() => +(document.querySelector('.h-ko .num b span')?.textContent || 0));
  report.clickAttacksWork = report.kosAfterClicks > kosBeforeClicks;
  if (!report.clickAttacksWork) throw new Error('click attacks did not register in sandbox — pointer-lock fallback broken');
  // language switch inside the sandbox: zh must restore the original Chinese HUD
  await frame.click('#pipy-lang-btn'); await sleep(700);
  report.zhName = await frame.evaluate(() => document.querySelector('.h-player .name')?.textContent);
  report.zhKoLabel = await frame.evaluate(() => document.querySelector('.h-ko small')?.textContent);
  await page.screenshot({ path: path.join(out, 'sandbox-zh.png') });
  await frame.click('#pipy-lang-btn'); await sleep(700);
  report.enNameRestored = await frame.evaluate(() => document.querySelector('.h-player .name')?.textContent);
  // pause menu still works in the sandbox
  await page.keyboard.press('Escape'); await sleep(600);
  report.pauseWorks = await frame.evaluate(() => !document.getElementById('menu').hidden);
  await page.keyboard.press('Escape'); await sleep(400);
  report.fps = await frame.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const loop = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(loop); else res(Math.round(n / 1.5)); }; requestAnimationFrame(loop); }));
} catch (e) {
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors; report.consoleErrs = consoleErrs.slice(0, 20); report.failedRequests = failed.slice(0, 20);
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
await browser.close();
srv.close();
const bad = report.fatal || errors.length > 0 || !(report.kos > 0);
console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify(report, null, 1));
process.exit(bad ? 1 : 0);