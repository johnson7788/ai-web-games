// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 480×270 game.gif（前 3 秒见开火+目标）
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VID_DIR = join(ROOT, 'tests', 'artifacts');
mkdirSync(VID_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { server, port } = await serve(ROOT, 8155);
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VID_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitForBoot(page, 10000);
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count()) await skip.click({ force: true }).catch(() => {});
await page.waitForTimeout(500);

// 真实指针：按住开火 + 追踪最近敌人（核心动词 + 目标）
await page.mouse.move(640, 200);
await page.mouse.down();
const T = 46; // 46 × 100ms ≈ 4.6s
for (let i = 0; i < T; i += 1) {
  const target = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r) return { x: 640, y: 200 };
    let best = null;
    let bd = Infinity;
    for (const e of r.enemies) {
      const d = Math.hypot(e.x - 640, e.y - 560);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? { x: best.x, y: best.y } : { x: 640, y: 200 };
  });
  await page.mouse.move(target.x, target.y, { steps: 2 });
  if (i % 15 === 8) { await page.keyboard.down('Shift'); await sleep(60); await page.keyboard.up('Shift'); }
  await sleep(100);
}
await page.mouse.up();

// 关键：先 close context 让 playwright 落盘视频，再读 webm（并行 saveAs 会卡死）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const webm = readdirSync(VID_DIR).filter((f) => f.endsWith('.webm')).sort().pop();
if (!webm) { console.error('no webm found'); process.exit(1); }
const webmPath = join(VID_DIR, webm);
const palettePath = join(VID_DIR, 'gif-palette.png');
const outPath = join(ROOT, 'game.gif');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-vf', 'fps=11,scale=480:270:flags=lanczos,palettegen', palettePath], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-i', palettePath, '-lavfi', 'fps=11,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a', outPath], { stdio: 'ignore' });
console.log('saved', outPath);
process.exit(0);
