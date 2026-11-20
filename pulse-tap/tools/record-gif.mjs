// 录制真实玩法 → webm → ffmpeg palettegen 转 game.gif（480×270，3–6s 循环）。
// 前 3 秒必须看到核心玩法动作：注入 bot 实时命中下落 note，录真实节奏反馈。
// 用法：node tools/record-gif.mjs [levelIndex] [seed]
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
await new Promise((r) => server.listen(8164, r));

const levelIdx = Number(process.argv[2] ?? 5);
const seed = Number(process.argv[3] ?? 5);
const videoDir = join(ROOT, 'tests', 'artifacts');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: videoDir, size: { width: 480, height: 270 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8164/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
  window.__ll.run().state.countdown = 0.02; // 跳过倒计时，让 note 立刻开始下落
  // 实时命中 bot：note 临近判定线就点，保证节奏动作 + PERFECT 反馈
  window.__bot = setInterval(() => {
    const run = window.__ll.run();
    if (!run || run.state.phase !== 'playing') return;
    const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);
    const now = run.state.time;
    for (const n of run.state.notes) {
      if (!REAL.has(n.kind)) continue;
      if (n.status !== 'pending' && n.status !== 'active') continue;
      if (Math.abs(now - n.time) < 0.02) run.tap(n.track);
    }
  }, 16);
}, [levelIdx, seed]);
await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__bot));
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读最新录制的 webm（saveAs 会卡死，这里 ctx.close 后从目录取）
const files = (await readdir(videoDir)).filter((f) => f.endsWith('.webm')).sort();
const webm = join(videoDir, files[files.length - 1]);
console.log('recorded', webm);
const gif = join(ROOT, 'game.gif');
const palette = join(videoDir, 'palette.png');
execFileSync('ffmpeg', ['-y', '-ss', '0.9', '-t', '5', '-i', webm, '-vf', 'fps=18,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-ss', '0.9', '-t', '5', '-i', webm, '-i', palette, '-lavfi', 'fps=18,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', gif], { stdio: 'inherit' });
console.log('saved', gif);
process.exit(0);
