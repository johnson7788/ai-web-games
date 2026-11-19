// 截取验收图到 tests/final/（vision-review 扫描前 8 张）。
// 用法：node tools/shots.mjs
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
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png',
};

function loadPlaywright() {
  for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
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

async function shot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file });
  return name;
}

async function main() {
  const { server, port } = await serve(GAME_DIR, 8210);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message || e.stack));

  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots = [];

  // 1 标题（演示场景透出）
  shots.push(await shot(page, '01-title.png'));

  // 2 中文标题
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(250);
  shots.push(await shot(page, '02-title-zh.png'));
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });

  // 3 第 1 关对局
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(200);
  shots.push(await shot(page, '03-playing.png'));

  // 4 岩石飞行中（瞄准 + 投掷）
  await page.evaluate(() => {
    const st = window.__ll.sim();
    const e = st.enemies.find((x) => x.alive);
    if (e) { st.aim.active = true; st.aim.dx = (e.cx + e.core.dx) - 150; st.aim.dy = (e.cy + e.core.dy) - 500; st.aim.power = 1; }
  });
  await page.waitForTimeout(250);
  shots.push(await shot(page, '04-aim.png'));

  // 5 通关结算
  await page.evaluate(() => window.__ll.debug.autoSolve());
  await page.waitForTimeout(400);
  shots.push(await shot(page, '05-result.png'));

  // 6 L4 TNT 关卡
  await page.evaluate(() => window.__ll.debug.loadLevel(3));
  await page.waitForTimeout(500);
  shots.push(await shot(page, '06-tnt.png'));

  // 7 L5 人质关
  await page.evaluate(() => window.__ll.debug.loadLevel(4));
  await page.waitForTimeout(500);
  shots.push(await shot(page, '07-captive.png'));

  // 8 L6 BOSS 关
  await page.evaluate(() => window.__ll.debug.loadLevel(5));
  await page.waitForTimeout(500);
  shots.push(await shot(page, '08-boss.png'));

  // 移动端横屏
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mpage = await mctx.newPage();
  mpage.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  mpage.on('pageerror', (e) => errors.push(e.message || e.stack));
  await mpage.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await mpage.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await mpage.waitForTimeout(700);
  await mpage.evaluate(() => window.__ll.start(0));
  await mpage.waitForTimeout(400);
  await mpage.evaluate(() => window.__ll.tutorial.skip());
  await mpage.waitForTimeout(200);
  const mfile = path.join(OUT_DIR, '09-mobile.png');
  await mpage.screenshot({ path: mfile });
  shots.push('09-mobile.png');
  await mctx.close();

  await browser.close();
  server.close();
  console.log(JSON.stringify({ port, shots, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
