// 生成 poster.jpg（1280×720，标题屏/战斗屏画面）。
// 用法：node tools/poster.mjs
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
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
    const done = (b) => { sock.destroy(); resolve(b); };
    sock.setTimeout(250); sock.once('connect', () => done(true)); sock.once('timeout', () => done(true)); sock.once('error', () => done(false));
  });
}
function serve(rootDir, startPort = 8230) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = decodeURIComponent(url.pathname);
    if (file === '/' || file.endsWith('/')) file += 'index.html';
    const target = path.join(rootDir, file);
    if (!target.startsWith(rootDir)) { res.writeHead(403).end(); return; }
    fs.readFile(target, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    const tryListen = async (p, attempt = 0) => {
      if (attempt < 40 && await portBusy(p)) { tryListen(p + 1, attempt + 1); return; }
      server.once('error', (e) => (e.code === 'EADDRINUSE' && attempt < 40 ? tryListen(p + 1, attempt + 1) : reject(e)));
      server.listen(p, '127.0.0.1', () => resolve({ server, port: p }));
    };
    tryListen(startPort);
  });
}

async function main() {
  const { server, port } = await serve(GAME_DIR, 8230);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(GAME_DIR, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await browser.close();
  server.close();
  console.log('wrote poster.jpg');
}
main().catch((e) => { console.error(e); process.exit(1); });
