// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270 循环）。
// 慢节奏挂机：录制时把锤速/产量调高、大师之作进度提到 0.7，让前 3 秒就看到锻打动作 + 传世金光。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO_DIR = join(ROOT, 'tests', 'artifacts');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8171, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8171/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined');
await page.waitForTimeout(700);

await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 5);
  const r = window.__ll.run();
  if (r) {
    r.state.upgrades.speed = 30;   // 锤速拉满：摆锤 5 次/秒
    r.state.upgrades.power = 15;   // 产量放大：金币不断跳
    r.state.upgrades.temp = 3;
    r.state.masterpiece = 0.7;     // 2 秒后触发传世金光
  }
});
await page.waitForTimeout(3800);

await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();

// 从录制目录取最新 webm（ctx.close() 后 webm 已落盘）
const webms = (await readdir(VIDEO_DIR)).filter((f) => f.endsWith('.webm')).sort();
const webm = join(VIDEO_DIR, webms[webms.length - 1]);
if (!webms.length) { console.error('no webm recorded'); process.exit(1); }
console.log('webm:', webm);

const palette = join(VIDEO_DIR, 'gif-palette.png');
const out = join(ROOT, 'game.gif');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', palette]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-i', palette, '-filter_complex', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', out]);
console.log('wrote', out);
process.exit(0);
