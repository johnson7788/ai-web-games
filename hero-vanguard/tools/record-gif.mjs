// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，循环）
// 用法：node tools/record-gif.mjs
import { readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'gif-rec');
mkdirSync(TMP, { recursive: true });

const { server, port } = await serve(ROOT, 8148);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
// 首次引导存档先置位，避免录制画面被引导层遮挡
await page.addInitScript(() => localStorage.setItem('hero-vanguard:tutorial-done', 'true'));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll?.start === 'function' && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
// 等敌人进入战场（前 3 秒必须见核心动词+目标）
await page.waitForTimeout(2600);
// 录 4.5s：期间打出共鸣斩与换位（签名瞬间）
await page.keyboard.press('KeyJ');
await page.waitForTimeout(400);
await page.keyboard.press('Tab');
await page.waitForTimeout(400);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(400);
await page.keyboard.press('KeyQ');
await page.waitForTimeout(400);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(2400);
// 用 ctx.close() 落盘视频（saveAs 在并行环境会卡死）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const webms = readdirSync(TMP).filter((f) => f.endsWith('.webm'));
if (!webms.length) {
  console.error('no webm recorded in', TMP);
  process.exit(1);
}
const webm = join(TMP, webms.sort()[webms.length - 1]);
const gifOut = join(ROOT, 'game.gif');
const palette = join(TMP, 'palette.png');
// 480×270 循环 GIF（截取战斗开始的 4.5s）：paletteuse 保证体积 ≤2MB
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-ss', '3.4', '-t', '4.5', '-i', webm,
  '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=max_colors=128',
  palette,
], { stdio: 'inherit' });
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-ss', '3.4', '-t', '4.5', '-i', webm, '-i', palette,
  '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4',
  '-loop', '0',
  gifOut,
], { stdio: 'inherit' });
console.log('saved', gifOut);
process.exit(0);
