// tools/record-gif.mjs — 录制真实玩法（逐帧截图 → ffmpeg 合成 game.gif）
// 用法：node tools/record-gif.mjs [framesDir] [levelIndex]
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const framesDir = process.argv[2] || 'tests/artifacts/gif-frames';
const levelIdx = Number(process.argv[3] ?? 8);
const FRAMES = 45;   // 4.5s @ 10fps
const INTERVAL = 100;

process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); process.exit(1); });

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
const port = 8300 + Math.floor(Math.random() * 500);
await new Promise((r) => server.listen(port, '127.0.0.1', r));
console.log('serving on', port);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(900);
await page.evaluate((lv) => { window.__ll.tutorial.skip(); window.__ll.jump(lv); }, levelIdx);

// 后台按 Hierholzer 轨迹逐星连线（真实玩法）
const tracePromise = page.evaluate(async () => {
  const run = window.__ll.run;
  const plan = [];
  run.solution().forEach((s, i) => {
    if (i > 0) plan.push({ to: s.trail[0], switch: true });
    for (let k = 1; k < s.trail.length; k += 1) plan.push({ to: s.trail[k] });
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const item of plan) {
    if (window.__ll.run !== run || run.phase !== 'playing') break;
    run.step({ to: item.to });
    await sleep(360);
  }
});

await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
for (let f = 0; f < FRAMES; f += 1) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
  const name = `frame_${String(f).padStart(3, '0')}.jpg`;
  await (await import('node:fs/promises')).writeFile(join(ROOT, framesDir, name), buf);
  await page.waitForTimeout(INTERVAL);
}
await tracePromise;

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('frames saved to', framesDir);
process.exit(0);
