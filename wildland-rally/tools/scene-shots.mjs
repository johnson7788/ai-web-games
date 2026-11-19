// WILDLAND RALLY · 验收截图：真实跑游戏，抓战斗画面（敌人带「!」标记 + HUD 目标计数）。
// 输出 tests/final/*.png（供 vision-review）+ 根目录 poster.jpg（1280×720）。
// 用法：node tools/scene-shots.mjs [--poster-only]
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(import.meta.url.replace(/^file:/, ''));
const GAME_DIR = path.resolve(__dirname, '..');
const FINAL_DIR = path.join(GAME_DIR, 'tests', 'final');

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

function serve(rootDir, startPort = 8226) {
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
  const { server, port } = await serve(GAME_DIR, 8226);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message || e.stack));

  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);

  fs.mkdirSync(FINAL_DIR, { recursive: true });

  // 进入战斗（跳过教程，开自动驾驶让玩家活到多波，保证战斗画面无教程卡）
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.setAutopilot(true); window.__ll.start(); });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(FINAL_DIR, '01-combat.png') });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(FINAL_DIR, '02-combat.png') });

  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(FINAL_DIR, '03-combat.png') });

  // poster：抓一个敌人多、目标标记清晰的战斗帧（1280×720）
  await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 92 });

  await browser.close();
  server.close();

  const shots = ['01-combat.png', '02-combat.png', '03-combat.png'];
  console.log(JSON.stringify({ port, shots, poster: 'poster.jpg', errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
