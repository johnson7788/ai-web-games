// COLOR FLUX · 录制真实玩法 → game.gif（480×270，约 4.5s 循环）
// 用法：node tools/record-gif.mjs
// 采用逐帧截图（15fps）+ ffmpeg paletteuse，避免 recordVideo 软件渲染过慢。
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = join(ROOT, 'tests', 'artifacts', 'gif-frames');
const FPS = 15;
const SECS = 4.5;
const N = Math.round(FPS * SECS);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8156, r));
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8156/');
await page.waitForTimeout(900);
await page.evaluate(() => { window.__ll.setLang('en'); window.__ll.start(); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.setAutoPlay(true));

// 逐帧截图（15fps × 4.5s）
for (let i = 0; i < N; i += 1) {
  await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(1000 / FPS);
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ffmpeg：png 序列 → 480×270 gif
const FF = '/opt/homebrew/bin/ffmpeg';
const pal = '/tmp/color-flux-pal.png';
execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=max_colors=256', pal], { stdio: 'ignore' });
execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-i', pal, '-lavfi', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', join(ROOT, 'game.gif')], { stdio: 'ignore' });
console.log('saved', join(ROOT, 'game.gif'));
process.exit(0);
