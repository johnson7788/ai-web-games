// 录制真实玩法 → webm，再 ffmpeg palettegen 转 game.gif（480×270 循环）。
// 用法：node tools/record-gif.mjs [out.gif]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8148, r));

const out = process.argv[2] || 'game.gif';
const webm = join(ROOT, 'tests/artifacts/gameplay.webm');
const palette = join(ROOT, 'tests/artifacts/palette.png');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
});
await page.waitForTimeout(400);
// 实时注入 greedy 控制器，让锦鲤以正常速度扑过鸟居门（前 3 秒即可见核心动作）
await page.evaluate(() => {
  window.__gifDrive = setInterval(() => {
    const r = window.__ll.run();
    if (!r) return;
    if (!r.state.started) { r.flap(); return; }
    const g = r.gateAhead();
    if (!g) { if (r.state.koi.vy > 0 && r.state.koi.y > 350) r.flap(); }
    else if (r.state.koi.vy > 0 && r.state.koi.y > g.targetY - 10) r.flap();
  }, 16);
});
await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__gifDrive));
const video = page.video();
await ctx.close().catch(() => {});
try { await video.saveAs(webm); } catch (e) { console.error('saveAs failed:', e.message); }
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ffmpeg：webm → 480×270 循环 gif（3–6s、≤2MB）
try {
  execSync(
    `ffmpeg -y -i "${webm}" -t 4 -vf "fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff" "${palette}"`,
    { stdio: 'inherit' },
  );
  execSync(
    `ffmpeg -y -i "${webm}" -i "${palette}" -filter_complex "fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" -t 4 "${join(ROOT, out)}"`,
    { stdio: 'inherit' },
  );
} catch (e) { console.error('ffmpeg failed:', e.message); }
console.log('saved', out);
process.exit(0);
