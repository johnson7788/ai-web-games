// tools/record-gif.mjs — 录制真实玩法 webm → ffmpeg 转 game.gif（480×270, 4.5s, ≤2MB）
// 前 3 秒必须见核心动词（瞄准开火）+ 目标（货箱）；不是标题屏。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const PORT = 8149;
const WEBM_DIR = join(ROOT, 'tests', 'artifacts');

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
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: WEBM_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);

// 直接开局并跳过引导
await page.click('#btn-start');
await page.waitForTimeout(500);
if (await page.locator('[data-tutorial-skip]').count()) {
  await page.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
}

// 真实鼠标：先朝中央货箱直射
await page.mouse.move(640, 260);
await page.mouse.down();
await page.waitForTimeout(2000);
// 再打右侧崖壁，展示回声横扫（护盾目标弹回命中）
await page.mouse.move(1184, 220);
await page.waitForTimeout(1500);
await page.mouse.move(96, 260);
await page.waitForTimeout(1200);
await page.mouse.up();

await page.waitForTimeout(300);
await ctx.close().catch(() => {}); // ctx.close 会定稿视频（saveAs 在并行环境会卡死）
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到刚生成的 webm
const webms = readdirSync(WEBM_DIR).filter((f) => f.endsWith('.webm')).map((f) => join(WEBM_DIR, f)).sort((a, b) => b.length - a.length);
const webm = webms[0];
if (!webm) { console.error('no webm recorded'); process.exit(1); }

// ffmpeg：裁 4.5s → 480×270 → palette 抖动 → game.gif
const ff = '/opt/homebrew/bin/ffmpeg';
const palette = join(WEBM_DIR, 'palette.png');
const gif = join(ROOT, 'game.gif');
execFileSync(ff, ['-y', '-i', webm, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
execFileSync(ff, ['-y', '-i', webm, '-i', palette, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', gif], { stdio: 'ignore' });

const size = existsSync(gif) ? (await import('node:fs')).statSync(gif).size : 0;
console.log('saved game.gif', gif, Math.round(size / 1024) + 'KB');
process.exit(0);
