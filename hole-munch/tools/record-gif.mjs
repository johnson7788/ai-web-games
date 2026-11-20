// 录制真实玩法 → 逐帧截图 → ffmpeg 转 game.gif（列表页缩略动图）
// 用法：node tools/record-gif.mjs
// 产出：游戏根目录 game.gif（480×270、约 4.5s、≤2MB）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = join(ROOT, 'tests/artifacts/gif-frames');
const gifOut = join(ROOT, 'game.gif');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
mkdirSync(FRAMES, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8167/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);

// 开局 + 跳过引导，从「已经在玩」的第一秒开始
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone();
  window.__ll.debug.startSeeded(123);
});

// 真实时间驱动黑洞追吃，并逐帧截图（约 4.5s × 10fps）
const FPS = 10;
const DURATION = 4.5;
const frameMs = 1000 / FPS;
let frame = 0;
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < DURATION) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing' || !r.player.alive) return;
    let best = null;
    let bestD = Infinity;
    for (const o of r.objects) {
      if (o.r >= r.player.r * 0.9) continue;
      const d = Math.hypot(o.x - r.player.x, o.y - r.player.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) window.__ll.debug.steerWorld(best.x, best.y);
  });
  await page.screenshot({ path: join(FRAMES, `frame-${String(frame).padStart(3, '0')}.png`) });
  frame += 1;
  const elapsed = Date.now() - t0;
  const sleep = Math.max(0, frameMs - (elapsed % frameMs));
  await page.waitForTimeout(sleep);
}

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 帧序列 → 480×270 gif（palettegen/paletteuse，循环播放）
const FF = '/opt/homebrew/bin/ffmpeg';
const palette = join(ROOT, 'tests/artifacts/palette.png');
execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'frame-%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen', palette]);
execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'frame-%03d.png'), '-i', palette, '-filter_complex', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', gifOut]);
console.log('saved', gifOut, 'frames=' + frame);
process.exit(0);
