// 录制真实玩法 → game.gif（480×270 循环，前 3 秒即核心动作）。
// 用真实 rAF 时间驱动：注入定时自动发钩，边播边截帧，最后 ffmpeg 合 gif。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8155, '127.0.0.1', r));

const FRAMES = join(ROOT, 'tests', 'artifacts', 'gif-frames');
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE_ERR:', m.text()); });
page.on('pageerror', (e) => console.error('PAGE_ERR:', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.error('HTTP', r.status(), r.url()); });
await page.goto('http://127.0.0.1:8155/', { waitUntil: 'load' });
let booted = false;
for (let i = 0; i < 60 && !booted; i += 1) {
  await page.waitForTimeout(200);
  booted = await page.evaluate(() => typeof window.__ll !== 'undefined').catch(() => false);
}
if (!booted) { await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200); }
await page.waitForTimeout(600);

await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
});
await page.waitForTimeout(400);

// 注入实时自动发钩（真实 rAF 步进，边玩边截）
await page.evaluate(() => {
  window.__hgAuto = setInterval(() => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') return;
    if (r.state.hook.state !== 'idle') return;
    let best = null; let bs = -1;
    for (const o of r.state.objects) {
      if (!o.alive || o.value <= 0) continue;
      if (o.hazard === 'clam' && !o.clamOpen) continue;
      const dx = o.x - 640, dy = o.y - 172;
      const d = Math.hypot(dx, dy) || 1;
      const sc = o.value / (o.mass * (1 + d / 400));
      if (sc > bs) { bs = sc; best = o; }
    }
    if (best) { r._aim(best.x, best.y); r.fire(); }
  }, 70);
});

const FPS = 10;
const SECS = 4.5;
const N = Math.round(FPS * SECS);
for (let i = 0; i < N; i += 1) {
  await page.screenshot({ path: join(FRAMES, `frame_${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(1000 / FPS);
}
await page.evaluate(() => clearInterval(window.__hgAuto));
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-framerate', String(FPS),
  '-i', join(FRAMES, 'frame_%03d.png'),
  '-vf', `fps=${FPS},scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
  '-loop', '0', join(ROOT, 'game.gif')], { stdio: 'ignore' });
console.log('game.gif done');
