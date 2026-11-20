// tools/record-gif.mjs — 录制真实玩法（驾驶 + 糖霜漂移 + 加速）→ game.gif。
// 用法：node tools/record-gif.mjs
// 流程：playwright 录屏（webm）→ ctx.close() 再读 webm 目录 → ffmpeg paletteuse 转 480×270 gif。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8157, r));

const videoDir = join(ROOT, 'tests/artifacts');
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8157/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 8000 });
// 立刻开局并跳过引导，让「前 3 秒」直接进入玩法（不是标题屏）
await page.evaluate(() => { window.__ll.start(); });
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForTimeout(200);

// 核心动词 + 目标：油门起步 → 转向 → 漂移蓄力 → 松手喷加速
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(700);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.down('Shift');
await page.waitForTimeout(900);   // 糖霜漂移蓄力 + 奶油拖尾
await page.keyboard.up('Shift');  // 松手 → 糖霜加速
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(1600);  // 加速冲刺
await page.keyboard.up('ArrowUp');

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ctx.close() 之后读 webm（saveAs 在并行环境会卡死，改用读目录）
const files = await readdir(videoDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm 录像'); process.exit(1); }
const src = join(videoDir, webm);
const palette = join(videoDir, 'gif-palette.png');
const out = join(ROOT, 'game.gif');

execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', src, '-t', '4.5', '-vf', 'fps=20,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'pipe' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', src, '-i', palette, '-t', '4.5', '-lavfi', 'fps=20,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', out], { stdio: 'pipe' });

console.log('saved', out);
process.exit(0);
