// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270、~4.5s、≤2MB）。
// 用 playwright 逐帧截图（可靠，避免 recordVideo saveAs 在此环境卡死）→ ffmpeg paletteuse。
// 前 3 秒见核心动词（拖拽温度计）+ 目标（冰水），后段是过关的博士坏笑。
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
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
await rm(FRAME_DIR, { recursive: true, force: true });
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => window.__ll.tutorial.skip());
await page.evaluate(() => window.__ll.startLevel(1));
await page.waitForTimeout(400);

const FPS = 15;
const DUR = 4.5;
const FRAMES = Math.round(FPS * DUR); // 67
let shot = 0;

// 第 0.4s：静止展示目标
for (let i = 0; i < Math.round(0.4 * FPS); i += 1) {
  await page.screenshot({ path: join(FRAME_DIR, `frame-${String(shot).padStart(3, '0')}.png`) });
  shot += 1;
  await page.waitForTimeout(1000 / FPS);
}

// 第 0.4s–2.2s：真实拖拽（温度计 → 冰水），逐帧可见物体移动
const DRAG_FRAMES = Math.round(1.8 * FPS);
await page.mouse.move(380, 420);
await page.mouse.down();
for (let i = 0; i < DRAG_FRAMES; i += 1) {
  const t = i / Math.max(1, DRAG_FRAMES - 1);
  const x = 380 + (920 - 380) * t;
  const y = 420 + Math.sin(t * Math.PI) * -60;
  await page.mouse.move(x, y);
  await page.screenshot({ path: join(FRAME_DIR, `frame-${String(shot).padStart(3, '0')}.png`) });
  shot += 1;
  await page.waitForTimeout(1000 / FPS);
}
await page.mouse.up();

// 第 2.2s–4.5s：过关结算 + 博士坏笑
while (shot < FRAMES) {
  await page.screenshot({ path: join(FRAME_DIR, `frame-${String(shot).padStart(3, '0')}.png`) });
  shot += 1;
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
