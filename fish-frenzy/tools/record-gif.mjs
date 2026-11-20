// tools/record-gif.mjs — 录制真实玩法（瞄准/撒网/捕获）→ webm → ffmpeg 转 game.gif（480×270, ≤2MB）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8160, r));

const webm = join(ROOT, 'tests/artifacts/gameplay.webm');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8160/');
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);

// 进入玩法
await page.click('#btn-start');
await page.waitForTimeout(700);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(400);

// 驱动真实玩法：每 120ms 朝最值的鱼发射（真实瞄准→撒网→捕获）
const started = Date.now();
while (Date.now() - started < 4200) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing') return;
    let best = null;
    for (const f of r.fish) {
      if (!f.alive || f.x < -20 || f.x > 1300) continue;
      if (!best || (f.value / f.hp) > (best.value / best.hp)) best = f;
    }
    if (best) r.step({ aimX: best.x, aimY: best.y, fire: true, tier: 3 });
  });
  await page.waitForTimeout(120);
}
await page.waitForTimeout(300);

// 保存录像：先取引用，关闭 context 后再 saveAs（Playwright 顺序坑）
const video = page.video();
await ctx.close().catch(() => {});
try { await video.saveAs(webm); } catch (e) { console.error('saveAs failed:', e.message); }
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ffmpeg：trim 前 1s（跳过标题过渡）+ 取 4.5s → paletteuse 480×270 gif
const gif = join(ROOT, 'game.gif');
const palette = join(ROOT, 'tests/artifacts/palette.png');
const ff = '/opt/homebrew/bin/ffmpeg';
execFileSync(ff, ['-y', '-i', webm, '-ss', '1.0', '-t', '4.5', '-vf', 'fps=10,scale=480:270:flags=lanczos,palettegen=max_colors=128', palette]);
execFileSync(ff, ['-y', '-i', webm, '-i', palette, '-filter_complex', 'fps=10,scale=480:270:flags=lanczos,trim=1:5.5,setpts=PTS-STARTPTS[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', gif]);
console.log('saved', gif);
process.exit(0);
