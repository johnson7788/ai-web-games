// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270, ~4.5s, ≤2MB）
// 前 3 秒必须见核心动词（吞噬）+ 目标（发光浮游/小鱼）。用鼠标真实驱动，不用 run.step 直调。
// ffmpeg 在 /opt/homebrew/bin。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
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
await new Promise((r) => server.listen(8147, r));

const VIDEO_DIR = join(ROOT, 'tests', 'artifacts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await sleep(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});

// 把玩家推进到阶段 2，让主角在镜头里足够大、足够亮
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.mass = 55;
  r.step({ steerX: null, steerY: null });
});

// 鼠标真实驱动：追最近的浮游/可吞小鱼（核心动词 = 游动 + 吞噬）
for (let i = 0; i < 90; i += 1) {
  const target = await page.evaluate(() => {
    const r = window.__ll.run;
    const p = r.player;
    let best = null;
    let b = Infinity;
    for (const f of r.foods) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < b) { b = d; best = f; }
    }
    for (const f of r.fish) {
      if (f.toxic) continue;
      if (f.r <= p.r) {
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d < b) { b = d; best = f; }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  });
  if (target) await page.mouse.move(Math.round(target.x), Math.round(target.y));
  await sleep(50);
}

// 收尾：close 落盘（避免并行环境 saveAs 卡死），再读 webm 目录
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
  .map((f) => ({ f, t: statSync(join(VIDEO_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
if (!webms.length) { console.error('no webm recorded'); process.exit(1); }
const src = join(VIDEO_DIR, webms[0].f);
const out = join(ROOT, 'game.gif');
const pal = join(VIDEO_DIR, 'gif-palette.png');

execFileSync(FFMPEG, ['-y', '-t', '4.5', '-i', src, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff:max_colors=256', pal], { stdio: 'pipe' });
execFileSync(FFMPEG, ['-y', '-t', '4.5', '-i', src, '-i', pal, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a', '-loop', '0', out], { stdio: 'pipe' });

const kb = statSync(out).size / 1024;
console.log('saved', out, `${kb.toFixed(0)}KB`);
process.exit(0);
