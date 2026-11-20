// tools/record-gif.mjs — 录制真实玩法（答题冲刺）→ webm → ffmpeg 转 480×270 game.gif。
// 前 3 秒即见核心动词（点选答案）+ 目标（终点线/名次）。录完用 ctx.close() 冲视频，避免 saveAs 卡死。
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'gif-webm');
mkdirSync(TMP, { recursive: true });

const { server, port } = await serve(ROOT, 8148);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });

// 轮询 boot 完成（与 _lib.mjs waitForBoot 一致）
const start = Date.now();
while (Date.now() - start < 10000) {
  const ready = await page.evaluate(() => !!(window.__ll && window.__ll.state.phase !== 'boot')).catch(() => false);
  if (ready) break;
  await page.waitForTimeout(100);
}

await page.waitForTimeout(300);
await page.click('#btn-start');
await page.waitForTimeout(600);
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForTimeout(300);

// 自动点正确选项：真实点击路径，录到「答对冲刺 + 连击」的核心动词
await page.evaluate(() => {
  window.__gifTimer = setInterval(() => {
    const r = window.__ll.run;
    if (r && r.question && !r.question.answered && r.phase === 'playing') {
      const el = document.getElementById('opt-' + r.question.answerIndex);
      if (el) el.click();
    }
  }, 130);
});

await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__gifTimer));
await ctx.close();
await browser.close();
server.close();

const webm = readdirSync(TMP).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('✗ 未找到 webm');
  process.exit(1);
}
const webmPath = join(TMP, webm);
const palette = join(TMP, 'palette.png');
const gifOut = join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

execFileSync(FFMPEG, ['-y', '-i', webmPath, '-vf', 'fps=24,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'ignore' });
execFileSync(FFMPEG, [
  '-y', '-i', webmPath, '-i', palette,
  '-lavfi', 'fps=24,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
  '-loop', '0', '-t', '4.5', gifOut,
], { stdio: 'ignore' });

rmSync(TMP, { recursive: true, force: true });
console.log('saved', gifOut);
process.exit(0);
