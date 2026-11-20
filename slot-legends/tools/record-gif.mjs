// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270, ≤2MB）。
// 前 3 秒必须见核心动词 + 目标：转轮 → 中奖连线 → 免费旋转/金雨。
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tests/artifacts');
const GIF = join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
mkdirSync(OUT_DIR, { recursive: true });

const { server, port } = await serve(ROOT, 8180);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForFunction(() => window.__ll.state.phase === 'playing', { timeout: 5000 });
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForFunction("window.__ll.run.phase === 'idle'", { timeout: 8000 });

async function doSpin(force) {
  await page.evaluate((f) => {
    if (f) window.__ll.run.pendingForce = f;
    window.__ll.spin();
  }, force);
}

// 1) 中奖（连线下清晰可见）
await doSpin('win');
await page.waitForFunction("window.__ll.run.phase === 'settle'", { timeout: 8000 });
await page.waitForTimeout(700);
await page.waitForFunction("window.__ll.run.phase === 'idle'", { timeout: 8000 });

// 2) 免费旋转（聚义厅）
await doSpin('free');
await page.waitForFunction("window.__ll.run.phase === 'settle'", { timeout: 8000 });
await page.waitForTimeout(800);
await page.waitForFunction("window.__ll.run.phase === 'idle'", { timeout: 8000 });

// 3) jackpot 金雨
await doSpin('jackpot');
await page.waitForFunction("window.__ll.run.phase === 'settle'", { timeout: 8000 });
await page.waitForTimeout(1300);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

// 找 webm 文件
const webm = readdirSync(OUT_DIR).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('no webm produced');
  process.exit(1);
}
const webmPath = join(OUT_DIR, webm);
console.log('recorded', webmPath);

// ffmpeg 两段调色板转 gif
const pal = join(OUT_DIR, 'palette.png');
const vf = 'fps=12,scale=480:270:flags=lanczos';
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-t', '4.5', '-vf', `${vf},palettegen=stats_mode=diff`, pal], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-t', '4.5', '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, GIF], { stdio: 'ignore' });
const size = readFileSync(GIF).length;
console.log('saved', GIF, (size / 1024 / 1024).toFixed(2) + 'MB');
