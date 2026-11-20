// SNAKE ARENA · 录制真实玩法帧 → ffmpeg 转 game.gif（480×270 / 4.5s / ≤2MB）
// 用 page.screenshot 逐帧截图（比 recordVideo 更稳），10fps × 4.5s = 45 帧。
// 用法：node tools/record-gif.mjs [outGif]   （默认写仓库根 game.gif）
import { createServer } from 'node:http';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const outGif = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, 'game.gif');
const frameDir = join(dirname(outGif), '.gif-frames');
mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
await page.click('#btn-start', { force: true });
await page.waitForTimeout(600);
await page.click('[data-tutorial-skip]', { force: true }).catch(() => {});

const foods = await page.evaluate(() => (window.__ll.run ? window.__ll.run.foods.slice(0, 8).map((f) => ({ x: f.x, y: f.y })) : []));
const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, scaleX: 1280 / r.width, scaleY: 720 / r.height };
});
const toPage = (f) => ({ x: rect.left + f.x / rect.scaleX, y: rect.top + f.y / rect.scaleY });

const FPS = 10;
const DUR = 4.5;
const frameMs = 1000 / FPS;
const total = Math.round(FPS * DUR);
const t0 = Date.now();
for (let i = 0; i < total; i += 1) {
  const f = foods[Math.floor(i / (total / Math.max(1, foods.length))) % Math.max(1, foods.length)];
  if (f) {
    const p = toPage(f);
    await page.mouse.move(p.x, p.y, { steps: 3 }).catch(() => {});
  }
  await page.screenshot({ path: join(frameDir, `f${String(i).padStart(3, '0')}.png`) });
  const next = t0 + (i + 1) * frameMs;
  const wait = next - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
}

await page.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

try {
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(frameDir, 'f%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', join(frameDir, 'palette.png')], { stdio: 'ignore' });
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(frameDir, 'f%03d.png'), '-i', join(frameDir, 'palette.png'), '-lavfi', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', outGif], { stdio: 'ignore' });
  const kb = Math.round(readFileSync(outGif).length / 1024);
  console.log('game.gif:', kb + 'KB', '(frames=' + total + ')');
  if (kb > 2048) console.log('WARNING: gif > 2MB');
} finally {
  rmSync(frameDir, { recursive: true, force: true });
}
console.log('saved', outGif);
process.exit(0);
