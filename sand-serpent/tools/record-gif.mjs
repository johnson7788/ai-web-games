// 录制真实玩法 → 帧序列 → ffmpeg 转 game.gif（480×270 循环，前 3 秒必须是核心玩法动作）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const framesDir = join(ROOT, 'tests/artifacts/gif-frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

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

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(1, 5); // L2 有墙，greedy 追甲虫吃
});
// 实时贪婪转向（蛇会追着食物吃）
await page.evaluate(() => {
  window.__gifTimer = setInterval(() => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') { clearInterval(window.__gifTimer); return; }
    const d = window.__ll.debug.greedyDir();
    if (d) r.input(d);
  }, 70);
});

const N = 48; // ~5s 素材（约 10fps 播放）
for (let i = 0; i < N; i += 1) {
  await page.screenshot({ path: join(framesDir, `f${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(100);
}
await page.evaluate(() => { if (window.__gifTimer) clearInterval(window.__gifTimer); });
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const palette = join(ROOT, 'tests/artifacts/gif-palette.png');
execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', join(framesDir, 'f%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette]);
execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', join(framesDir, 'f%03d.png'), '-i', palette, '-lavfi', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', join(ROOT, 'game.gif')]);

console.log('saved', join(ROOT, 'game.gif'));
process.exit(0);
