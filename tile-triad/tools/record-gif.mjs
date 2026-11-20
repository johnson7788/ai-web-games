// TILE TRIAD · 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，3–6s 循环，≤2MB）。
// 前 3 秒必须看到核心玩法动作：拾取入槽 → 三同消除 → 香料烟尘。
// 用法：node tools/record-gif.mjs [levelIndex] [seed]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const levelIdx = Number(process.argv[2] ?? 0);
const seed = Number(process.argv[3] ?? 3);
const videoDir = join(ROOT, 'tests', 'artifacts', 'giftmp');
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(([lv, sd]) => window.__ll.debug.startSeeded(lv, sd), [levelIdx, seed]);
await page.waitForTimeout(500);

const taps = await page.evaluate(() => window.__ll.run().solution().slice(0, 12));
for (const sid of taps) {
  await page.evaluate((s) => window.__ll.debug.tapStack(s), sid);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);

// 先关 context 让录像落盘（saveAs 在并行环境下会卡住）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = (await readdirSync(videoDir)).filter((f) => f.endsWith('.webm'));
if (!webms.length) {
  console.error('no webm recorded');
  process.exit(1);
}
const webm = join(videoDir, webms[0]);
const gif = join(ROOT, 'game.gif');
const pal = join(videoDir, 'palette.png');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=max_colors=128', pal], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-i', pal, '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', gif], { stdio: 'ignore' });
console.log('saved', gif);
process.exit(0);
