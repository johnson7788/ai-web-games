// Shadow Ninja Cat · 录制真实玩法 webm（ffmpeg 转 game.gif 用）。
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
// 注意：Playwright saveAs 在并行环境会卡死，这里用 ctx.close() 后直接读 webm 目录。
import { createServer } from 'node:http';
import { readFile, readdir, rename } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
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
await new Promise((r) => server.listen(8147, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 0);
const seed = Number(process.argv[4] ?? 5);
const recDir = join(ROOT, 'tests', 'artifacts', 'rec');
mkdirSync(recDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: recDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(600);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
  const s = window.__ll.run().state;
  s.phase = 'playing';
  s.countdown = 0; // 跳过倒计时，前 3 秒就要看到玩法动作
  // 浏览器内 greedy bot：正常帧循环推进 sim，这里只发 jump/dive
  const CW = 96;
  const gh = (c) => c && (c.t === 'gap' || c.t === 'spike' || c.t === 'enemy');
  window.__snBot = setInterval(() => {
    const r = window.__ll.run();
    if (!r || (r.state.phase !== 'playing')) return;
    const s = r.state;
    const front = Math.floor(s.x / CW);
    if ((gh(s.course[front]) || gh(s.course[front + 1]) || gh(s.course[front + 2])) && s.onGround) r.jump();
    else if (!s.onGround && s.y > 60 && !gh(s.course[front]) && !gh(s.course[front + 1])) r.dive();
  }, 16);
}, [levelIdx, seed]);
await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__snBot));
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ctx.close() 后才读 webm（避免 saveAs 卡死）
const files = (await readdir(recDir)).filter((f) => f.endsWith('.webm'));
if (!files.length) {
  console.error('no webm recorded');
  process.exit(1);
}
await rename(join(recDir, files[0]), join(ROOT, out));
console.log('saved', out);
process.exit(0);
