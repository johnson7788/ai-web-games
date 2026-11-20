// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg paletteuse → game.gif（480×270, 4.5s, ≤2MB）
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VDIR = join(ROOT, 'tests', 'artifacts');
mkdirSync(VDIR, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webm': 'video/webm' };
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

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VDIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/');
await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count() && await skip.isVisible()) { await skip.click({ force: true }); await page.waitForTimeout(400); }

// 真实玩法：连续点击发射光子钉入能量核（前 4.5s 见核心动词 + 目标）
for (let i = 0; i < 8; i += 1) {
  await page.mouse.click(640, 620);
  await page.waitForTimeout(560);
}
await page.waitForTimeout(300);

// 关闭 context 以落盘 webm（saveAs 在并行环境会卡死，直接读 webm 目录）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webm = (await readdir(VDIR)).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm 录制文件'); process.exit(1); }
const webmPath = join(VDIR, webm);
const gifPath = join(ROOT, 'game.gif');
const palettePath = join(VDIR, 'palette.png');

const ff = '/opt/homebrew/bin/ffmpeg';
execFileSync(ff, ['-y', '-i', webmPath, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen', palettePath]);
execFileSync(ff, ['-y', '-i', webmPath, '-i', palettePath, '-filter_complex', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', '-t', '4.5', gifPath]);
console.log('saved', gifPath);
process.exit(0);
