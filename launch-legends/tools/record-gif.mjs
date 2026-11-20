// 录制真实玩法 → game.gif（480×270 循环，≤2MB）
// 用法：node tools/record-gif.mjs
// 自起 http 服务 → 进入 L3 云絮连击 → 自动驾驶 → 逐帧截图 → ffmpeg palettegen 转 gif。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8178, r));

const framesDir = join(ROOT, 'tests', 'artifacts', 'frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
const palette = join(ROOT, 'tests', 'artifacts', 'gif-palette.png');
const gif = join(ROOT, 'game.gif');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
await page.goto('http://127.0.0.1:8178/');
await page.waitForTimeout(500);
// L3 云絮连击：通道连续出云，撞云动作密集（前 3 秒即核心玩法）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(2, 3);
  window.__ll.debug.setAutopilot(true);
});
await page.waitForTimeout(250);

const FRAMES = 54;
for (let i = 0; i < FRAMES; i += 1) {
  await page.screenshot({ path: join(framesDir, `f${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(90);
}
await page.evaluate(() => window.__ll.debug.setAutopilot(false));
await browser.close();
server.closeAllConnections?.();
server.close();

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
execFileSync(FFMPEG, ['-y', '-framerate', '11', '-i', join(framesDir, 'f%03d.png'), '-vf', 'palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-framerate', '11', '-i', join(framesDir, 'f%03d.png'), '-i', palette, '-lavfi', 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', gif], { stdio: 'ignore' });

console.log('saved', gif);
process.exit(0);
