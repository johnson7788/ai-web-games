// 截 8 张验收图 + poster.jpg（进 tests/final/，供 vision-review 与发布物料）。
// 用法：node tools/scene-shots.mjs
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(GAME_DIR, 'tests', 'final');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/homebrew/lib/node_modules/playwright',
    '/Users/admin/.npm-global/lib/node_modules/playwright',
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

function portBusy(p) {
  return new Promise((resolve) => {
    const sock = net.connect({ port: p, host: '127.0.0.1' });
    const done = (busy) => { sock.destroy(); resolve(busy); };
    sock.setTimeout(250);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(true));
    sock.once('error', () => done(false));
  });
}

function serve(rootDir, startPort = 8210) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = decodeURIComponent(url.pathname);
    if (file === '/' || file.endsWith('/')) file += 'index.html';
    const target = path.join(rootDir, file);
    if (!target.startsWith(rootDir)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(target, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    const tryListen = async (p, attempt = 0) => {
      if (attempt < 40 && await portBusy(p)) { tryListen(p + 1, attempt + 1); return; }
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && attempt < 40) tryListen(p + 1, attempt + 1);
        else reject(e);
      });
      server.listen(p, '127.0.0.1', () => resolve({ server, port: p }));
    };
    tryListen(startPort);
  });
}

async function main() {
  const { server, port } = await serve(GAME_DIR, 8210);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });
  const errors = [];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message || e.stack));

  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);

  const shot = (name) => page.screenshot({ path: path.join(OUT_DIR, name) });

  // 01 标题屏（背后有实景 demo）
  await shot('01-title.png');

  // 02 游玩中（实体 + HUD）
  await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
  await page.evaluate(() => window.__ll.debug.advance(4.5));
  await page.waitForTimeout(250);
  await shot('02-playing.png');
  // poster.jpg：战斗屏（1280×720）
  await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 90 });

  // 03 高连击
  await page.evaluate(() => window.__ll.debug.advance(4));
  await page.waitForTimeout(200);
  await shot('03-combo.png');

  // 04 护盾（手动给 run 加护盾）
  await page.evaluate(() => { const r = window.__ll.run(); if (r) r.state.shield = true; });
  await page.waitForTimeout(200);
  await shot('04-shield.png');

  // 05 结算（贪婪快进到通关）
  await page.evaluate(() => window.__ll.debug.fastForward());
  await page.waitForTimeout(300);
  await shot('05-result.png');

  // 06 标题-中文
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); window.__ll.home(); });
  await page.waitForTimeout(400);
  await shot('06-title-zh.png');

  // 07 移动端游玩（横屏）
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('console', (m) => { if (m.type() === 'error') errors.push('[m]' + m.text()); });
  mp.on('pageerror', (e) => errors.push('[m]' + (e.message || e.stack)));
  await mp.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await mp.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(800);
  await mp.evaluate(() => window.__ll.debug.startSeeded(0, 5));
  await mp.evaluate(() => window.__ll.debug.advance(4));
  await mp.waitForTimeout(250);
  await mp.screenshot({ path: path.join(OUT_DIR, '07-m-playing.png') });

  await mctx.close();
  await browser.close();
  server.close();

  console.log(JSON.stringify({ port, out: OUT_DIR, poster: path.join(GAME_DIR, 'poster.jpg'), errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
