// tools/record-gif.mjs — 录制真实玩法 → ffmpeg 生成 game.gif（480×270，paletteuse）。
// 前 3 秒即见核心动词：机房守夜（敲地鼠）+ 得分目标。
import { mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const tmp = join(__dirname, '.gif-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const OUT = join(root, 'game.gif');

const { server, port } = await serve(root, 8220);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir: tmp, size: { width: 960, height: 540 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(500);

await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count() && await skip.isVisible()) await skip.click({ force: true });
await page.waitForTimeout(250);

// 进入机房守夜，注入真实指针点按（真实操作模型），录制 4.5s
await page.click('#cab-0');
await page.waitForTimeout(500);
await page.evaluate(() => {
  window.__gifbot = setInterval(() => {
    const r = window.__ll.run;
    if (!r || r.machine !== 0 || !r.sub) return;
    const up = r.sub.holes.filter((h) => h.up && !h.hazard);
    if (!up.length) return;
    const h = up[0];
    const cv = document.getElementById('canvas');
    const rect = cv.getBoundingClientRect();
    const sx = rect.left + (h.x / 1280) * rect.width;
    const sy = rect.top + (h.y / 720) * rect.height;
    try {
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy, bubbles: true, pointerId: 1 }));
    } catch { /* ignore */ }
  }, 90);
});
await page.waitForTimeout(4500);
await page.evaluate(() => { clearInterval(window.__gifbot); });
await page.waitForTimeout(300);

await ctx.close();
await browser.close();
server.close();

const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到录制 webm'); process.exit(1); }
const webmPath = join(tmp, webm);
const pal = join(tmp, 'palette.png');
// 裁掉 boot/标题屏，只保留核心玩法段（前 3 秒必须见核心动词+目标）
const SS = '2.8';
const T = '4.6';
execFileSync(FFMPEG, ['-y', '-ss', SS, '-t', T, '-i', webmPath, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', pal], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-ss', SS, '-t', T, '-i', webmPath, '-i', pal, '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', OUT], { stdio: 'ignore' });
console.log('game.gif written:', OUT);
