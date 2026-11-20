// tools/record-gif.mjs — 录制真实玩法 → webm，再用 ffmpeg 转 game.gif（480×270）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
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
await new Promise((r) => server.listen(8148, r));

const webm = join(ROOT, 'tests', 'artifacts', 'gameplay.webm');
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/');
await page.waitForTimeout(800);

// 跳过引导，直接进入玩法（真实游戏画面 + 目标分 HUD）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(1, 42);
});
await page.waitForTimeout(500);

// 连续点爆最大连通块：前 3 秒即见核心动词（爆破）+ 目标（得分/目标分 HUD）
for (let i = 0; i < 6; i += 1) {
  await page.evaluate(() => window.__ll.debug.popLargest());
  await page.waitForTimeout(560);
}
await page.waitForTimeout(600);

const videoPath = page.video() ? page.video().path() : null;
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

if (videoPath) {
  const { copyFileSync } = await import('node:fs');
  try { copyFileSync(videoPath, webm); } catch (e) { console.error('copy video failed:', e.message); }
}

// ffmpeg：480×270 4.5s 循环，跳过加载屏，paletteuse 调色板 GIF
const gif = join(ROOT, 'game.gif');
try {
  execFileSync(FFMPEG, [
    '-y', '-ss', '1.2', '-i', webm, '-t', '4.5',
    '-vf', 'fps=20,scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    gif,
  ], { stdio: 'inherit' });
  console.log('saved', gif);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
