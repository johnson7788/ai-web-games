// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270、~4.5s、≤2MB）
// 用 playwright 逐帧截图（可靠，避免 recordVideo 在此环境的 saveAs 卡死）→ ffmpeg paletteuse。
// 前 3 秒见核心动词（弹弓发射）+ 目标（下坠陨石带）。
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const FRAME_DIR = join(ROOT, 'tests', 'artifacts', 'gif-frames');

setTimeout(() => { console.error('record-gif timeout'); process.exit(1); }, 120000).unref?.();

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
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('ball-orbit:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.run.step({ aimAngle: 0.16, fire: true }));

// 逐帧截图 4.5s @ 15fps；第二发在 ~2.4s 打出
const FPS = 15;
const DUR = 4.5;
const FRAMES = Math.round(FPS * DUR); // 67
for (let i = 0; i < FRAMES; i += 1) {
  if (i === Math.round(2.4 * FPS)) {
    await page.evaluate(() => window.__ll.run.step({ aimAngle: -0.18, fire: true }));
  }
  await page.screenshot({ path: join(FRAME_DIR, `frame-${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(1000 / FPS);
}

await ctx.close();
await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }

try {
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', join(ROOT, 'tests', 'artifacts', 'palette.png')], { stdio: 'pipe', timeout: 30000 });
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-i', join(ROOT, 'tests', 'artifacts', 'palette.png'), '-filter_complex', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', join(ROOT, 'game.gif')], { stdio: 'pipe', timeout: 30000 });
  console.log('saved', join(ROOT, 'game.gif'));
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
