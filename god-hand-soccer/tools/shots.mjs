// 生成验收截图（tests/final/01..08.png，供 vision-review）与 poster.jpg（1280×720）。
// 用 debug 契约把游戏驱动到可读、剪影清晰的画面：标题（吸引演示）/ 战斗 / 晶片 / 岩石 / 连击 / 结算 / 选关 / 中文标题。
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
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function loadPlaywright() {
  const candidates = ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright'];
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await sleep(2000); // 让吸引演示跑出障碍

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shot = async (name) => page.screenshot({ path: path.join(OUT_DIR, name) });

  // 01 标题（含吸引演示）
  await shot('01-title.png');

  // 02 战斗：第 1 关（目标距离可见），等第一排屏障逼近
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await sleep(1500);
  await shot('02-play.png');

  // 03 晶片：关卡 1 + 注入晶片/道具/屏障场景
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => window.__ll.debug.seedScene());
  await page.evaluate(() => { if (window.__ll.sim()) window.__ll.sim().combo = 0; });
  await sleep(250);
  await shot('03-shards.png');

  // 04 岩石：关卡 3（有岩石）+ 注入岩石场景
  await page.evaluate(() => window.__ll.start(2));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => window.__ll.debug.seedRock());
  await sleep(250);
  await shot('04-rock.png');

  // 05 连击：关卡 1 + 注入场景并抬高连击 HUD
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => window.__ll.debug.seedScene());
  await page.evaluate(() => { if (window.__ll.sim()) { window.__ll.sim().combo = 4; window.__ll.sim().orbsCollected = 6; window.__ll.sim().score = 640; } });
  await sleep(250);
  await shot('05-combo.png');

  // 06 结算：关卡 1 强制到终点 → 结算屏（星级）
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => { const st = window.__ll.debug.state(); window.__ll.debug.setDistance(st.targetM - 0.05); });
  await page.waitForFunction(() => window.__ll.state.phase === 'result', { timeout: 5000 }).catch(() => {});
  await sleep(300);
  await shot('06-result.png');

  // 07 选关：回主页并展开关卡面板
  await page.evaluate(() => window.__ll.home());
  await page.evaluate(() => { document.getElementById('btn-levels').click(); });
  await sleep(300);
  await shot('07-levels.png');

  // 08 中文游戏内（中文 HUD + 目标距离/终点线可见）
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => window.__ll.ui().setLang('zh'));
  await page.evaluate(() => window.__ll.debug.seedScene());
  await sleep(300);
  await shot('08-zh.png');

  // poster.jpg：用晶片场景（战斗屏最好看）
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForFunction(() => window.__ll.state.phase === 'playing');
  await page.evaluate(() => window.__ll.debug.seedScene());
  await page.evaluate(() => { if (window.__ll.sim()) { window.__ll.sim().combo = 5; window.__ll.sim().score = 900; } });
  await sleep(300);
  await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 90 });

  await browser.close();
  server.close();

  const shots = fs.readdirSync(OUT_DIR).filter((n) => /\.png$/i.test(n)).sort();
  console.log(JSON.stringify({ port, poster: 'poster.jpg', shots, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
