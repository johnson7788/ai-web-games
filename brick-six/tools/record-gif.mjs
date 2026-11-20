// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270 / 4.5s / ≤2MB）。
// 用法：node tools/record-gif.mjs
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outGif = path.join(root, 'game.gif');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'brick-six-gif-'));

const { server, port } = await serve(root, 8188);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(400);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count()) await skip.click({ force: true });
await page.waitForTimeout(200);

// 自动打：真实落子 + 消除/金瀑粒子 + HUD 分数爬升（前 3 秒就见核心动词与目标）
await page.evaluate(() => {
  const r = window.__ll.run;
  r.__gifTimer = setInterval(() => {
    if (!r || r.phase !== 'playing') return;
    const before = r.stats.clears;
    const casc = r.stats.cascadeCount;
    const ps = r.enumeratePlacements();
    if (!ps.length) return;
    const filled = new Set(r.cells.map((c, i) => (c.filled ? i : -1)).filter((i) => i >= 0));
    let best = ps[0];
    let bs = -Infinity;
    for (const p of ps) {
      const f2 = new Set(filled);
      for (const i of p.cells) f2.add(i);
      let lines = 0;
      for (const l of r.lines) if (l.every((i) => f2.has(i))) lines += 1;
      const s = lines * 1000 - p.cells.length;
      if (s > bs) { bs = s; best = p; }
    }
    r.debugPlace(best.slot, best.rot, best.anchor);
    if (r.stats.cascadeCount > casc) window.G.renderer.burst(640, 400, 'cascade');
    else if (r.stats.clears > before) window.G.renderer.burst(640, 400, 'clear');
  }, 360);
});

await page.waitForTimeout(4600);
await page.evaluate(() => clearInterval(window.__ll.run.__gifTimer));
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到 webm 录像');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
const webmPath = path.join(tmp, webm);
const palettePath = path.join(tmp, 'palette.png');

// 两遍调色板，压到 480×270
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', '-frames:v', '1', palettePath], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-i', palettePath, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', outGif], { stdio: 'ignore' });

rmSync(tmp, { recursive: true, force: true });
const { statSync } = await import('node:fs');
const kb = Math.round(statSync(outGif).size / 1024);
console.log('saved', outGif, `${kb}KB`);
