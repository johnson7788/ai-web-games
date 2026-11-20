// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，3–6s 循环，≤2MB）。
// 用法：node tools/record-gif.mjs
// 安全点：用 ctx.close() 落盘视频，再读 webm 目录（避免 Playwright saveAs 并行卡死）。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

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
await new Promise((r) => server.listen(8168, r));

const videoDir = join(ROOT, 'tests', 'artifacts', 'gifvideo');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, recordVideo: { dir: videoDir, size: { width: 640, height: 360 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8168/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
// L5 虎跳河吃子：选子 → 高亮 → 跳河 → 藤蔓吃子 → 胜利
await page.evaluate(() => window.__ll.debug.startSeeded(4, 5));
await page.waitForTimeout(750);
await page.evaluate(() => window.__ll.run().select(3, 0));
await page.waitForTimeout(950);
await page.evaluate(() => window.__ll.run().tap(3, 3));
await page.waitForTimeout(1600);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到落盘的 webm
const files = await readdir(videoDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到 webm 视频');
  process.exit(1);
}
const src = join(videoDir, webm);
const out = join(ROOT, 'game.gif');
const palette = join(videoDir, 'palette.png');
// palettegen + paletteuse → 480×270 gif
execFileSync('ffmpeg', ['-y', '-i', src, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=max_colors=128', palette], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-i', src, '-i', palette, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', out], { stdio: 'inherit' });
console.log('saved', out);
process.exit(0);
