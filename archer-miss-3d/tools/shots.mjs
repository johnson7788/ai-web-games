// ARCHER MISS 3D · 截战斗验收图到 tests/final（供 vision-review）+ poster.jpg。
// 用法：node tools/shots.mjs
// 用真实运行截图（不是灰屏）；服务用完即关。
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
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

function loadPlaywright() {
  const candidates = ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright'];
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
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

function serve(rootDir, startPort = 8220) {
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
      server.once('error', (e) => { if (e.code === 'EADDRINUSE' && attempt < 40) tryListen(p + 1, attempt + 1); else reject(e); });
      server.listen(p, '127.0.0.1', () => resolve({ server, port: p }));
    };
    tryListen(startPort);
  });
}

async function main() {
  const { server, port } = await serve(GAME_DIR, 8220);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots = [];
  const errors = [];

  async function freshPage(viewport = { width: 1280, height: 720 }, isMobile = false) {
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message || e.stack));
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__ll.save().set('tutorialSeen', true));
    return { context, page };
  }

  async function shot(page, name) {
    const file = path.join(OUT_DIR, name);
    await page.screenshot({ path: file, animations: 'disabled' });
    shots.push(name);
    return file;
  }

  // 桌面：多个战斗时刻
  {
    const { context, page } = await freshPage();
    // 1 竞技场全景
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__ll.debug.setMove(0, 1));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__ll.debug.setMove(0, 0));
    await page.waitForTimeout(200);
    await shot(page, '01-arena.png');

    // 2 敌人逼近 + 目标标记
    await page.waitForTimeout(1200);
    await shot(page, '02-targets.png');

    // 3 射箭瞬间
    await page.evaluate(() => window.__ll.debug.setMove(0, -1));
    await page.waitForTimeout(90);
    await page.evaluate(() => window.__ll.debug.setMove(0, 0));
    await page.waitForTimeout(260);
    await shot(page, '03-shooting.png');
    await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 88 });

    // 4 第 2 关：施法者弹道 + 预警
    await page.evaluate(() => window.__ll.start(1));
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__ll.debug.setMove(0, 1));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__ll.debug.setMove(0, 0));
    await page.waitForTimeout(600);
    await shot(page, '04-caster-combat.png');
    await context.close();
  }

  // 移动端
  {
    const { context, page } = await freshPage({ width: 844, height: 390 }, true);
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__ll.debug.setMove(0, 1));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.__ll.debug.setMove(0, 0));
    await page.waitForTimeout(350);
    await shot(page, '05-mobile.png');
    await context.close();
  }

  await browser.close();
  server.close();
  console.log(JSON.stringify({ port, shots, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
