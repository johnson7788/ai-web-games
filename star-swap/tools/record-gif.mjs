// tools/record-gif.mjs — 录制真实玩法 → ffmpeg paletteuse → game.gif（480×270 / 4.5s / ≤2MB）
// 前 3 秒必须见核心动词（交换）+ 目标（HUD 目标分）：录制期持续 autoSwap。
// 坑：Playwright recordVideo 的 saveAs 并行会卡死 → 用 dir 录，ctx.close() 后再读 webm。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const { serve, loadPlaywright } = await import('../../../skills/webgame-playbook/scripts/_lib.mjs');
const { chromium } = loadPlaywright();

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'star-swap-gif-'));
const server = await serve(root, 8210);
const url = `http://127.0.0.1:${server.port}/`;

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});

const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => { window.__ll.startLevel(1); if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
await page.waitForTimeout(300);

// 持续真实交换 ~4.6 秒（每 160ms 一步，带随机扰动模拟人类节奏）
const t0 = Date.now();
while (Date.now() - t0 < 4600) {
  await page.evaluate(() => window.__ll.debug.autoSwap());
  await page.waitForTimeout(160 + Math.floor(Math.random() * 80));
}

await page.waitForTimeout(300);
await ctx.close(); // 关键：先 close 让 webm 落盘
server.server.close();

const webm = fs.readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm'); process.exit(1); }
const webmPath = path.join(tmpDir, webm);

const palette = path.join(tmpDir, 'palette.png');
const outGif = path.join(root, 'game.gif');
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'pipe' });
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-i', palette, '-filter_complex', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', '-t', '4.5', outGif], { stdio: 'pipe' });

const size = fs.statSync(outGif).size;
console.log(`✓ game.gif  ${(size / 1048576).toFixed(2)}MB`);
if (size > 2 * 1048576) { console.error('✗ 超过 2MB'); process.exit(1); }
fs.rmSync(tmpDir, { recursive: true, force: true });
