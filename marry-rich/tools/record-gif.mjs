// tools/record-gif.mjs — MARRY RICH · 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270）。
// 前 3 秒必须见核心动词（点选项）+ 目标（逆袭/人生天平）；录制从限时抉择节点开始。
// 用法：node tools/record-gif.mjs [out.webm]
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8150, r));

const webmPath = process.argv[2] || join(ROOT, 'tests/artifacts/gameplay.webm');
const videoDir = dirname(webmPath);
await new Promise((r) => { import('node:fs').then((fs) => { fs.mkdirSync(videoDir, { recursive: true }); r(); }); });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8150/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title');
await page.evaluate(() => localStorage.clear());

// 直接跳到第 5 章「跳槽抉择」：限时 + 人生天平 + 三选项（核心动词 + 目标都在前 3 秒）。
await page.evaluate(() => window.__ll.debug.startSeeded([0, 0, 0, 0]));
await page.waitForTimeout(1600);
// 点一个选项 → 天平倾斜 → 结果卡
await page.click('.choice-btn[data-choice="1"]');
await page.waitForTimeout(1200);
// 继续到下一章，形成自然循环点
await page.click('#btn-continue');
await page.waitForTimeout(1400);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 从 recordVideo 目录找出刚生成的 webm（ctx.close() 后才会落盘，避免 saveAs 卡死）
const files = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'));
const newest = files.sort().map((f) => join(videoDir, f)).at(-1);
if (!newest) {
  console.error('未找到 webm 录屏文件');
  process.exit(1);
}
const { rename } = await import('node:fs/promises');
await rename(newest, webmPath);

// ffmpeg：webm → 480×270 gif（paletteuse）
const gifPath = join(ROOT, 'game.gif');
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-ss', '0.8', '-t', '4.5', '-i', webmPath,
  '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff',
  join(videoDir, 'palette.png'),
], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-ss', '0.8', '-t', '4.5', '-i', webmPath, '-i', join(videoDir, 'palette.png'),
  '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
  '-loop', '0', gifPath,
], { stdio: 'ignore' });

console.log('saved', webmPath);
console.log('saved', gifPath);
process.exit(0);
