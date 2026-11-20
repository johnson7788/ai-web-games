// 录制真实玩法 → webm（ffmpeg 转 game.gif 用，480×270 循环）
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const VID_DIR = join(ROOT, 'tests', 'artifacts', 'gif-vid');
mkdirSync(VID_DIR, { recursive: true });

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
await new Promise((r) => server.listen(8155, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VID_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8155/');
await page.waitForTimeout(600);

// 开始第 1 关，把时钟提前拨到首个 note 即将落线，自动完美演奏：note 逼近 + 斩击 + 和弦斩
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  window.__ll.run().state.beatClock = 2.4;
  window.__gifTimer = setInterval(() => { try { window.__ll.debug.autoPlayTick(); } catch (e) {} }, 16);
});
await page.waitForTimeout(6500);
await page.evaluate(() => { try { clearInterval(window.__gifTimer); } catch (e) {} });

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到录制的 webm（ctx.close 已落盘）
const webm = readdirSync(VID_DIR).filter((f) => f.endsWith('.webm')).map((f) => join(VID_DIR, f)).sort((a, b) => b.length - a.length)[0];
if (!webm) {
  console.error('未找到 webm 录像');
  process.exit(1);
}

const gif = join(ROOT, 'game.gif');
try {
  execSync(
    `ffmpeg -y -ss 1.0 -i "${webm}" -vf "fps=15,scale=480:270:flags=lanczos,palettegen=max_colors=128" "${VID_DIR}/palette.png"`,
    { stdio: 'pipe' },
  );
  execSync(
    `ffmpeg -y -ss 1.0 -i "${webm}" -i "${VID_DIR}/palette.png" -lavfi "fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" -t 5 -loop 0 "${gif}"`,
    { stdio: 'pipe' },
  );
  console.log('saved', gif);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
