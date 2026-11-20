// 录制真实玩法 → webm（ffmpeg 转 game.gif：480×270 循环）。
// 用法：node tools/record-gif.mjs [levelIndex] [seed]
import { createServer } from 'node:http';
import { readdirSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
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
    const data = await readFileP(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8152, r));

const levelIdx = Number(process.argv[2] ?? 0);
const seed = Number(process.argv[3] ?? 5);
const videoDir = join(ROOT, 'tests', 'artifacts', 'gifvid');
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8152/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(500);
// 把敌人散到玩家周围，保证前 3 秒就是「割草」动作
await page.evaluate(() => {
  const s = window.__ll.sim();
  if (!s) return;
  const p = s.player;
  const list = s.enemies.slice(0, 6);
  list.forEach((e, i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.5;
    e.x = p.x + Math.cos(a) * (150 + (i % 3) * 24);
    e.y = p.y + Math.sin(a) * (105 + (i % 2) * 30);
  });
});
// 自动试玩：驱动 bot（移动+拾取+升级）
await page.evaluate(() => {
  window.__gifTimer = setInterval(() => {
    try { window.__ll.debug.botTick(); } catch (e) { /* noop */ }
  }, 16);
});
await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__gifTimer));
// 关闭 context（触发 webm 落盘）再读目录
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const files = readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
if (!files.length) {
  console.error('no webm recorded');
  process.exit(1);
}
const webm = join(videoDir, files[files.length - 1]);
const gifOut = join(ROOT, 'game.gif');
const palette = join(videoDir, 'palette.png');
execFileSync('ffmpeg', ['-y', '-i', webm, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=max_colors=128', palette], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', '-i', webm, '-i', palette, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', gifOut], { stdio: 'ignore' });
const mb = statSync(gifOut).size / 1048576;
console.log('saved', gifOut, `(${mb.toFixed(2)}MB)`);
rmSync(videoDir, { recursive: true, force: true });
process.exit(0);
