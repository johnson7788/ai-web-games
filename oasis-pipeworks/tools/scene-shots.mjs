// 截 4-5 张验收图：title + 三场景包 + playing（带 HUD）。
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
const OUT_DIR = path.join(GAME_DIR, 'tests', 'artifacts');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/opt/homebrew/lib/node_modules/playwright',
    '/Users/admin/.npm-global/lib/node_modules/playwright',
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* next */
    }
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

function serve(rootDir, startPort = 8126) {
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
  const { server, port } = await serve(GAME_DIR, 8126);
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

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const shots = [];

  // 标题屏
  await page.screenshot({ path: path.join(OUT_DIR, 'r-title.png') });
  shots.push('r-title.png');

  // 三个场景包
  const scenes = ['dawn-desert', 'dusk-canyon', 'night-oasis'];
  for (const s of scenes) {
    await page.evaluate((k) => window.__renderDemo(k), s);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, `r-scene-${s}.png`) });
    shots.push(`r-scene-${s}.png`);
  }

  // playing（带 HUD：demo 场景 + 顶部黑条）
  await page.evaluate(() => {
    window.__renderDemo('dawn-desert');
    document.getElementById('hud').classList.remove('hidden');
    const t = document.getElementById('screen-title');
    t.classList.add('hidden');
    t.classList.remove('is-active');
    document.getElementById('hud-level').textContent = 'Level 1 · Dawn Desert';
    document.getElementById('hud-time').textContent = '⏱ 32s';
    document.getElementById('hud-blooms').textContent = '🌸 2/2';
    document.getElementById('dig-badge').textContent = '1';
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT_DIR, 'r-playing.png') });
  shots.push('r-playing.png');

  await browser.close();
  server.close();

  console.log(JSON.stringify({ port, shots, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
