// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm]
// 前 3 秒必见核心动词（拖拽蓄力 + 松开发射）+ 目标（飞碟被击毁）。
import { createServer } from 'node:http';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

const portBusy = (p) => new Promise((resolve) => {
  const sock = net.connect({ port: p, host: '127.0.0.1' });
  const done = (busy) => { sock.destroy(); resolve(busy); };
  sock.setTimeout(250);
  sock.once('connect', () => done(true));
  sock.once('timeout', () => done(true));
  sock.once('error', () => done(false));
});

function listen(server, startPort) {
  return new Promise((resolve) => {
    const tryListen = async (p, attempt) => {
      if (attempt < 40 && await portBusy(p)) { tryListen(p + 1, attempt + 1); return; }
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && attempt < 40) tryListen(p + 1, attempt + 1);
        else { console.error(e); process.exit(1); }
      });
      server.listen(p, '127.0.0.1', () => resolve(p));
    };
    tryListen(startPort, 0);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});

// 硬超时兜底，绝不挂死
setTimeout(() => { console.error('record-gif timeout'); process.exit(1); }, 30000);

const port = await listen(server, 8160);
const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const browser = await chromium.launch();
// 用独立临时目录录屏，避免与历史 page@*.webm 混淆（saveAs 顺序坑）
const recDir = join(ROOT, dirname(out), '.rec-tmp');
const { mkdirSync, rmSync, readdirSync, renameSync } = await import('node:fs');
rmSync(recDir, { recursive: true, force: true });
mkdirSync(recDir, { recursive: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: recDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem('saucer-strike:tutorial-done', 'true'); } catch { /* noop */ }
});
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);

const cx = 640;
const cy = 660;
for (let i = 0; i < 7; i += 1) {
  const t = await page.evaluate(() => {
    const r = window.__ll.run;
    const s = r && r.saucers.find((x) => x.active);
    if (s) return { x: s.x, y: s.y };
    return { x: 640, y: 300 };
  });
  const ang = Math.atan2(t.y - cy, t.x - cx);
  const power = 0.7;
  const ax = cx + Math.cos(ang) * power * 360;
  const ay = cy + Math.sin(ang) * power * 360;
  await page.mouse.move(cx, cy + 24);
  await page.mouse.down();
  await page.waitForTimeout(240);
  await page.mouse.move(ax, ay, { steps: 6 });
  await page.waitForTimeout(180);
  await page.mouse.up();
  await page.waitForTimeout(220);
}
await page.waitForTimeout(700);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ctx.close() 已把录屏落盘到 recDir；取唯一那个 webm 改名
const files = readdirSync(recDir).filter((f) => f.endsWith('.webm'));
if (files.length) {
  renameSync(join(recDir, files[0]), join(ROOT, out));
  console.log('saved', out);
} else {
  console.error('no webm produced');
}
rmSync(recDir, { recursive: true, force: true });
process.exit(0);
