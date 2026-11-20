// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
import { createServer } from 'node:http';
import { readFile, readdir, rename, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8157, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 8); // L9 藏宝地窖（冠冕+金币）
const seed = Number(process.argv[4] ?? 7);

const videoDir = join(dirname(join(ROOT, out)), '.vids');
await mkdir(videoDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8157/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(500);
// 逐步出牌（每张 ~115ms，前 3 秒即见核心动作），录到通关或 6 秒
await page.evaluate(async () => {
  const moves = window.__ll.debug.solverMoves() || [];
  const t0 = performance.now();
  for (const mv of moves) {
    if (performance.now() - t0 > 6000) break;
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') break;
    r.executeMove(mv);
    await new Promise((res) => setTimeout(res, 115));
  }
});
await page.waitForTimeout(600);
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 取录好的 webm（ctx.close 后再读目录，避免 saveAs 卡死）
const vids = await readdir(videoDir);
const webm = vids.find((f) => f.endsWith('.webm'));
if (webm) {
  const src = join(videoDir, webm);
  if (existsSync(join(ROOT, out))) await rm(join(ROOT, out), { force: true });
  await rename(src, join(ROOT, out));
  await rm(videoDir, { recursive: true, force: true }).catch(() => {});
  console.log('saved', out);
} else {
  console.error('no webm recorded');
  process.exit(1);
}
process.exit(0);
