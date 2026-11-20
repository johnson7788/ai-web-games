// 录制真实玩法 → 逐帧截图 → ffmpeg 转 game.gif（480×270、≤2MB、循环）。
// 用法：node tools/record-gif.mjs [out.gif]
// 前 3 秒必须看到核心玩法：无尽模式 vs 随机蝎子，greedy 仙人掌连续落子直到获胜。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8257;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const outGif = process.argv[2] || 'game.gif';
const FRAME_DIR = join(ROOT, 'tests', 'artifacts', 'gif-frames');
if (existsSync(FRAME_DIR)) rmSync(FRAME_DIR, { recursive: true });
mkdirSync(FRAME_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console.error]', m.text()); });
  page.on('response', (res) => { if (res.status() >= 400) console.error('[http', res.status(), ']', res.url()); });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 20000 });
  let ready = false;
  for (let i = 0; i < 90; i += 1) {
    ready = await page.evaluate(() => !!(window.__ll && window.__ll.debug)).catch(() => false);
    if (ready) break;
    await page.waitForTimeout(200);
  }
  if (!ready) throw new Error('window.__ll.debug 未就绪');
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.startEndless('random');
  });
  await page.waitForTimeout(300);

  const FRAMES = 40;
  for (let i = 0; i < FRAMES; i += 1) {
    if (i % 3 === 0) {
      await page.evaluate(() => window.__ll.debug.greedyPlace()).catch(() => {});
    }
    await page.screenshot({ path: join(FRAME_DIR, `frame-${String(i).padStart(2, '0')}.png`) });
    await page.waitForTimeout(140);
  }
} finally {
  await browser.close().catch(() => {});
  server.closeAllConnections?.();
  server.close();
}

const palette = join(ROOT, 'tests', 'artifacts', 'gif-palette.png');
const seq = join(FRAME_DIR, 'frame-%02d.png');
execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', seq, '-vf', 'scale=480:270:flags=lanczos,palettegen=max_colors=128', palette], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-framerate', '10', '-i', seq, '-i', palette, '-lavfi', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', outGif], { stdio: 'inherit' });
console.log('saved', outGif);
process.exit(0);
