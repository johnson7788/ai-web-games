// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，4.5s，前 3 秒见合并动词 + HUD 目标）
// 关键：gif 从「已经在玩」的那一秒开始截——ffmpeg -ss 跳过加载/标题/tutorial 前奏。
// 用法：node tools/record-gif.mjs [levelIndex] [outGif]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8151, r));

const levelIdx = Number(process.argv[2] ?? 2);
const outGif = join(ROOT, process.argv[3] || 'game.gif');
const webm = join(ROOT, 'tests/artifacts/gameplay.webm');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8151/');
// 等 boot 完成出标题（而非固定 sleep），随后立刻开局并跳过引导，压缩 gif 前奏
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 8000 });
await page.evaluate((lv) => { window.__ll.startAct(lv); }, levelIdx);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
// 贪心 AI 真实驱动（每一发都是 move()，走键盘同一条路径），录制约 5.8s 玩法
for (let i = 0; i < 34; i += 1) {
  await page.evaluate(() => window.__ll.debug.greedyMove());
  await page.waitForTimeout(170);
}
await page.waitForTimeout(250);
// 先关 context 让 Playwright 落盘视频，再 saveAs（顺序反了会一直挂起）
const video = page.video();
await page.close().catch(() => {});
await ctx.close().catch(() => {});
try { if (video) await video.saveAs(webm); } catch (e) { console.error('saveAs failed:', e.message); }
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ffmpeg 两段式：palettegen → paletteuse；-ss 1.2 跳过加载/标题/tutorial，只留玩法
const ff = '/opt/homebrew/bin/ffmpeg';
const palette = join(ROOT, 'tests/artifacts/palette.png');
execFileSync(ff, ['-y', '-ss', '1.2', '-t', '4.5', '-i', webm, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'inherit' });
execFileSync(ff, ['-y', '-ss', '1.2', '-t', '4.5', '-i', webm, '-i', palette, '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', outGif], { stdio: 'inherit' });
console.log('saved', outGif);
process.exit(0);
