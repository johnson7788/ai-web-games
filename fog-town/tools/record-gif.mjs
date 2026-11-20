// tools/record-gif.mjs — 录制真实玩法 → webm，再 ffmpeg 转 480×270 game.gif。
// 注意：不用 video().saveAs()（并行环境会卡死）；用 ctx.close() 落盘后读 webm 目录。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VIDDIR = path.join(ROOT, 'tests', 'artifacts', 'gif');
fs.mkdirSync(VIDDIR, { recursive: true });
const GIF = path.join(ROOT, 'game.gif');
const FF = '/opt/homebrew/bin/ffmpeg';

const { server, port } = await serve(ROOT, 8700);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: VIDDIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);

// 进入玩法并跳过引导
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(350);
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForTimeout(200);

// 前 2s：真实移动揭雾 + 出口信标（核心动词 + 目标）
for (let i = 0; i < 13; i += 1) {
  await page.evaluate(() => window.__ll.debug.autoStep(2));
  await page.waitForTimeout(150);
}

// 后 2.5s：真相时刻（第 4 街区集齐 3 线索全图点亮）
await page.evaluate(() => window.__ll.debug.startAt(4));
await page.waitForTimeout(200);
for (let i = 0; i < 22; i += 1) {
  const active = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r.getHud().truthActive) window.__ll.debug.autoStep(3);
    return r.getHud().truthActive;
  });
  await page.waitForTimeout(120);
  if (active) break;
}
await page.waitForTimeout(1300);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

// 找到刚录的 webm
const webm = fs.readdirSync(VIDDIR).filter((f) => f.endsWith('.webm')).sort().pop();
if (!webm) {
  console.error('no webm recorded');
  process.exit(1);
}
const webmPath = path.join(VIDDIR, webm);
const palette = path.join(VIDDIR, 'palette.png');

execFileSync(FF, ['-y', '-ss', '1.6', '-t', '4.5', '-i', webmPath, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'inherit' });
execFileSync(FF, ['-y', '-ss', '1.6', '-t', '4.5', '-i', webmPath, '-i', palette, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', GIF], { stdio: 'inherit' });

const size = fs.statSync(GIF).size;
console.log('saved', GIF, `${(size / 1024 / 1024).toFixed(2)}MB`);
process.exit(0);
