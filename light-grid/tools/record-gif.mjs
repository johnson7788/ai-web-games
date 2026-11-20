// tools/record-gif.mjs — 录制真实玩法帧 → ffmpeg 合成 game.gif（480×270，≤2MB）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAME_DIR = join(ROOT, 'tests', 'artifacts', 'gif-frames');
const PALETTE = join(ROOT, 'tests', 'artifacts', 'palette.png');
const GIF = join(ROOT, 'game.gif');
const FPS = 22;

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
await new Promise((r) => server.listen(8147, r));
await rm(FRAME_DIR, { recursive: true, force: true });
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 12000 });
await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
await page.waitForTimeout(300);

const sol = await page.evaluate(() => window.__ll.run.solution.map((p) => [p[0], p[1]]));
const sol2 = await page.evaluate(() => window.__ll.run.solution.map((p) => [p[0], p[1]]));

// 帧序列：0-18 点亮第 1 关（核心动词+目标）→ 19-69 签名走线动画 → 70-99 第 2 关再点几步
const TOTAL = 100;
const name = (i) => join(FRAME_DIR, `frame-${String(i).padStart(3, '0')}.png`);
for (let i = 0; i < TOTAL; i += 1) {
  if (i === 0) {
    // 第一帧已开局
  } else if (i < 19) {
    const k = Math.floor((i - 1) / 5);
    if (k < sol.length) {
      await page.evaluate(([r, c]) => { if (window.__ll.run.phase === 'playing') window.__ll.run.press(r, c); }, sol[k]);
    }
  } else if (i === 19) {
    // 解出（最后一步在 i=18 已触发，若盘面较大则补齐剩余）
    await page.evaluate((s) => {
      const r = window.__ll.run;
      for (let k = 0; k < s.length && r.phase === 'playing'; k += 1) r.press(s[k][0], s[k][1]);
    }, sol);
  } else if (i === 70) {
    await page.evaluate(() => { if (window.__ll.run.phase === 'solved') window.__ll.run.nextLevel(); });
  } else if (i >= 72 && i < 99) {
    const k = Math.floor((i - 72) / 5);
    if (k < sol2.length) {
      await page.evaluate(([r, c]) => { if (window.__ll.run.phase === 'playing') window.__ll.run.press(r, c); }, sol2[k]);
    }
  }
  await page.screenshot({ path: name(i) });
  await page.waitForTimeout(Math.round(1000 / FPS));
}

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const vf = `scale=480:270:flags=lanczos`;
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-vf', `${vf},palettegen=stats_mode=diff`, PALETTE], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-i', PALETTE, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`, '-loop', '0', GIF], { stdio: 'ignore' });

console.log('saved', GIF);
process.exit(0);
