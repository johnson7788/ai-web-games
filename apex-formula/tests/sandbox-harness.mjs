// 沙箱复测：模拟 pipygames 线上 iframe（sandbox="allow-scripts"，opaque origin）。
// 所有响应带 Access-Control-Allow-Origin:*；根路径返回沙箱 iframe。
// 用法: /opt/homebrew/bin/node games/apex-formula/tests/sandbox-harness.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = path.join(dir, 'tests', 'final');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.ico': 'image/x-icon' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    s.end('<!doctype html><html><body style="margin:0;background:#222"><iframe sandbox="allow-scripts" src="/index.html?lang=zh" style="width:1280px;height:720px;border:0"></iframe></body></html>');
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
const ctx = await browser.newContext({ viewport: { width: 1300, height: 760 } });
const page = await ctx.newPage();
const errors = [], consoleErrs = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const report = { mode: 'sandbox allow-scripts (opaque origin), lang=zh', startedAt: new Date().toISOString() };
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(18000);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) throw new Error('iframe not found');
  report.origin = await frame.evaluate(() => window.origin);
  report.storageBlocked = await frame.evaluate(() => { try { localStorage.setItem('probe', '1'); return false; } catch { return true; } });
  report.titleText = await frame.evaluate(() => document.querySelector('.af-press')?.textContent ?? '');
  report.zhTitle = await frame.evaluate(() => document.body.innerText.includes('按下'));
  await page.screenshot({ path: path.join(out, 'sandbox-01-title-zh.png') });
  // 点击标题进入菜单（同时让 iframe 获得键盘焦点）
  await page.mouse.click(640, 360);
  report.menu = await frame.evaluate(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const s = document.querySelector('.af-v-main');
      if (s && !s.classList.contains('hidden')) return 'menu-ready';
      await new Promise((r) => setTimeout(r, 300));
    }
    return 'menu-timeout';
  });
  report.zhMenu = await frame.evaluate(() => document.body.innerText.includes('快速比赛'));
  await page.screenshot({ path: path.join(out, 'sandbox-02-menu-zh.png') });
  // 状态驱动导航：每步等待目标视图出现再按 Enter（避免低帧率下的时序问题）
  const waitView = (sel) => frame.evaluate(async (s) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      const el = document.querySelector(s);
      if (el && !el.classList.contains('hidden')) return 'ready';
      await new Promise((r) => setTimeout(r, 300));
    }
    return 'timeout';
  }, sel);
  await page.keyboard.press('Enter');
  report.drivers = await waitView('.af-v-drivers');
  await page.keyboard.press('Enter');
  report.circuits = await waitView('.af-v-circuits');
  await page.keyboard.press('Enter');
  report.session = await waitView('.af-v-session');
  await page.keyboard.press('Enter');
  // 等待发车格（程序化生成较重）
  report.grid = await frame.evaluate(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 300000) {
      const g = document.querySelector('.af-grid');
      if (g && !g.classList.contains('hidden')) return 'grid-ready';
      await new Promise((r) => setTimeout(r, 400));
    }
    return 'grid-timeout';
  });
  await page.screenshot({ path: path.join(out, 'sandbox-03-grid.png') });
  await page.keyboard.press('Enter');
  report.lights = await frame.evaluate(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      const tk = document.querySelector('.af-ticker');
      if (tk && (tk.textContent.includes('LIGHTS OUT') || tk.textContent.includes('灯灭'))) return 'lights-out';
      await new Promise((r) => setTimeout(r, 300));
    }
    return 'lights-timeout';
  });
  await page.keyboard.down('ArrowUp');
  report.speed = await frame.evaluate(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const v = parseInt(document.querySelector('.af-speed')?.textContent ?? '0', 10);
      if (v >= 30) return v;
      await new Promise((r) => setTimeout(r, 300));
    }
    return parseInt(document.querySelector('.af-speed')?.textContent ?? '0', 10);
  });
  report.speedKmh = report.speed;
  report.hudZh = await frame.evaluate(() => document.body.innerText.includes('挡位'));
  await page.screenshot({ path: path.join(out, 'sandbox-04-driving.png') });
  await page.keyboard.up('ArrowUp');
  await sleep(500);
} catch (e) {
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors;
report.consoleErrs = consoleErrs.slice(0, 20);
report.failedRequests = failed.slice(0, 20);
report.finishedAt = new Date().toISOString();
await browser.close();
srv.close();
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
const bad = report.fatal || errors.length > 0 || report.grid !== 'grid-ready' || !(Number(report.speedKmh) > 0) || report.origin !== 'null' || !report.storageBlocked;
console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify(report, null, 1));
process.exit(bad ? 1 : 0);