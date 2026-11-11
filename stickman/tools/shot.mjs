#!/usr/bin/env node
// 单次截图 / 冒烟自检工具（Lead 用，也供各 agent 验证）。
// 用法：
//   node tools/shot.mjs --out tests/artifacts/title.png --wait 1200
//   node tools/shot.mjs --out x.png --w 844 --h 390 --mobile --query "lang=en"
//   node tools/shot.mjs --out y.png --eval "window.__ll.startAct(0)" --wait 800
//   node tools/shot.mjs --out z.png --click "#btn-play" --wait 600
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPlaywright() {
  const candidates = ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright'];
  for (const candidate of candidates) {
    try { return require(candidate); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

function parseArgs(argv) {
  const args = { w: 1280, h: 720, wait: 1000, port: 8125, mobile: false, query: '', out: 'tests/artifacts/shot.png' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--out') { args.out = val; i += 1; }
    else if (key === '--w') { args.w = Number(val); i += 1; }
    else if (key === '--h') { args.h = Number(val); i += 1; }
    else if (key === '--wait') { args.wait = Number(val); i += 1; }
    else if (key === '--port') { args.port = Number(val); i += 1; }
    else if (key === '--mobile') { args.mobile = true; }
    else if (key === '--query') { args.query = val; i += 1; }
    else if (key === '--eval') { args.eval = val; i += 1; }
    else if (key === '--click') { args.click = val; i += 1; }
    else if (key === '--full') { args.full = true; }
    else if (key === '--allow-errors') { args.allowErrors = true; }
  }
  return args;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serve(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = decodeURIComponent(url.pathname);
    if (file === '/' || file.endsWith('/')) file += 'index.html';
    const target = path.join(root, file);
    if (!target.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    fs.readFile(target, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    const tryListen = (p, attempt = 0) => {
      server.once('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempt < 40) tryListen(p + 1, attempt + 1);
        else reject(error);
      });
      server.listen(p, '127.0.0.1', () => resolve(server));
    };
    tryListen(port);
  });
}

const args = parseArgs(process.argv.slice(2));
const { chromium } = loadPlaywright();
let server = await serve(args.port);
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${args.query ? `?${args.query}` : ''}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: args.w, height: args.h },
  deviceScaleFactor: args.mobile ? 2 : 1,
  isMobile: args.mobile,
  hasTouch: args.mobile,
});
const page = await context.newPage();
const errors = [];
const failed = [];
const external = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(err.stack || err.message));
page.on('requestfailed', (req) => failed.push(`${req.url()} ${req.failure()?.errorText}`));
page.on('response', (res) => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
page.on('request', (req) => {
  if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== `http://127.0.0.1:${port}`) external.push(req.url());
});

await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);
if (args.eval) {
  try { await page.evaluate(args.eval); } catch (error) { errors.push(`eval: ${error.message}`); }
}
if (args.click) {
  try { await page.click(args.click, { timeout: 5000 }); } catch (error) { errors.push(`click: ${error.message}`); }
}
await page.waitForTimeout(args.wait);

const out = path.resolve(root, args.out);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: !!args.full });

const stateInfo = await page.evaluate(() => {
  const ll = window.__ll;
  if (!ll) return null;
  const run = ll.run;
  return {
    phase: ll.state.phase,
    paused: ll.state.paused,
    act: run?.actIndex,
    wave: run?.waveIndex,
    enemies: run?.sim?.enemies?.length,
    bullets: run?.sim?.bullets?.length,
    ink: run?.sim?.player?.hp,
    score: run?.getHud?.().score,
  };
}).catch(() => null);

console.log(JSON.stringify({ url, out, errors, failed, external, state: stateInfo }, null, 2));
await browser.close();
server.close();
server = null;
if (!args.allowErrors && (errors.length || failed.length)) process.exit(1);
