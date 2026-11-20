// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg paletteuse → game.gif（480×270，循环）
// 用法：node tools/record-gif.mjs
// 前 3 秒必须见核心动词（点选填字）+ 目标（熔炉/缺字槽）；从「已经在玩」的那一秒开始录。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
await new Promise((r) => server.listen(8149, r));

const videoDir = join(ROOT, 'tests', 'artifacts');
mkdirSync(videoDir, { recursive: true });
const before = new Set(readdirSync(videoDir).filter((f) => f.endsWith('.webm')));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8149/', { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot' && document.getElementById('loading').classList.contains('hidden'), { timeout: 15000 }).catch(() => {});
await page.click('#btn-start');
await page.waitForTimeout(700);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(400);

// 真实点选填字：反复点正确候选字，驱动连击 + 铸兵器（约 4.5s 玩法画面）
const clickCorrect = () => page.evaluate(() => {
  const r = window.G.run;
  if (!r || r.phase !== 'playing') return;
  const h = r.getHud();
  const q = h.question;
  const want = q.answer[q.blanks[h.currentBlank]];
  const gi = h.grid.indexOf(want);
  const tiles = document.querySelectorAll('#board-grid .tile');
  if (tiles[gi]) tiles[gi].click();
});
await page.waitForTimeout(300);
for (let i = 0; i < 9; i += 1) {
  await clickCorrect();
  await page.waitForTimeout(480);
}

// 用 ctx.close() 落盘 video（并行环境 saveAs 会卡死，close 后再读 webm 目录）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(videoDir).filter((f) => f.endsWith('.webm') && !before.has(f));
if (!webms.length) {
  console.error('未找到新录制的 webm');
  process.exit(1);
}
const webm = join(videoDir, webms.sort().pop());

const gif = join(ROOT, 'game.gif');
const palette = join(videoDir, 'gif-palette.png');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
execFileSync(FFMPEG, ['-y', '-ss', '1.6', '-t', '4.5', '-i', webm, '-vf', 'fps=20,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-ss', '1.6', '-t', '4.5', '-i', webm, '-i', palette, '-lavfi', 'fps=20,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', gif], { stdio: 'ignore' });

const size = (existsSync(gif) ? (statSync(gif).size / 1024 / 1024).toFixed(2) : '?');
console.log('saved', gif, `${size}MB`, 'from', webm);
