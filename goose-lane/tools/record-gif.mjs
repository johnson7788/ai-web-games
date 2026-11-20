// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，4.5s）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO_DIR = join(ROOT, 'tests', 'artifacts', 'gif-video');
const OUT_GIF = join(ROOT, 'game.gif');
mkdirSync(VIDEO_DIR, { recursive: true });
for (const f of readdirSync(VIDEO_DIR)) if (f.endsWith('.webm')) { try { unlinkSync(join(VIDEO_DIR, f)); } catch { /* noop */ } }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
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
await new Promise((r) => server.listen(8147, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(700);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(300);

// 真实输入驱动：每 ~120ms 读局面，选安全且带宝石的车道，用方向键真实换道
const t0 = Date.now();
while (Date.now() - t0 < 4600) {
  const dir = await page.evaluate(() => {
    const r = window.__ll.run;
    const hazards = r.obstacles.filter((o) => !o.dead && !o.resolved && o.kind !== 'gate' && o.z > 0 && o.z < 20);
    const blocked = new Set(hazards.map((o) => o.lane));
    const free = [0, 1, 2].filter((l) => !blocked.has(l));
    if (!free.length) return 0;
    const pickups = r.pickups.filter((p) => !p.dead && !p.resolved && p.z > 0 && p.z < 22);
    let best = free.includes(r.lane) ? r.lane : free[0];
    let bestScore = -1;
    for (const l of free) {
      let s = 0;
      for (const p of pickups) if (p.lane === l) s += p.kind === 'gem' ? 3 : 2;
      if (s > bestScore) { bestScore = s; best = l; }
    }
    return best > r.lane ? 1 : (best < r.lane ? -1 : 0);
  });
  if (dir === 1) await page.keyboard.press('ArrowRight');
  else if (dir === -1) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(120);
}

await ctx.close().catch(() => {});   // close 后 webm 才落盘（saveAs 在并行环境会卡）
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webm = readdirSync(VIDEO_DIR).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('没有找到 webm'); process.exit(1); }
const src = join(VIDEO_DIR, webm);

// ffmpeg：截 4.5s → 480×270 → palette 优化 → gif（≤2MB）
const ffmpeg = '/opt/homebrew/bin/ffmpeg';
const palette = join(VIDEO_DIR, 'palette.png');
// -ss 1.4 跳过标题屏/教程，确保 gif 前 3 秒就是「已经在玩」的核心动词+目标
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '1.4', '-t', '4.5', '-i', src, '-vf', 'fps=24,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette]);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '1.4', '-t', '4.5', '-i', src, '-i', palette, '-lavfi', 'fps=24,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', OUT_GIF]);

const kb = Math.round(statSync(OUT_GIF).size / 1024);
console.log('saved', OUT_GIF, `${kb}KB`);
if (statSync(OUT_GIF).size > 2 * 1024 * 1024) { console.error('gif > 2MB'); process.exit(1); }
process.exit(0);
