// tools/record-gif.mjs — 录制真实玩法 → ffmpeg palette 转 480×270 gif（列表页 hover 动画）。
// Playwright recordVideo 录 webm → ctx.close() → ffmpeg palettegen/paletteuse（ffmpeg 在 /opt/homebrew/bin）。
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = join(root, 'gifwork');
mkdirSync(outDir, { recursive: true });
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const OUT_GIF = join(root, 'game.gif');

const { server, port } = await serve(root, 8170);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});

// 快速定位到关卡末端：终点旗 + 星星 + 金币同屏，前 3 秒即见「核心动词（跑/跳）+ 目标（旗）」
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.x = 2680;
  r.player.y = 558;
  r.player.vx = 0;
  r.cameraX = 2260;
});
await page.waitForTimeout(250);

// 真实输入：向右跑 + 跳跃，奔向旗帜
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(900);
await page.keyboard.press('Space');
await page.waitForTimeout(700);
await page.keyboard.press('Space');
await page.waitForTimeout(1300);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(900);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(300);

await context.close();
await browser.close();
server.close();

// 找到刚写的 webm
const webm = readdirSync(outDir).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('没有录到 webm');
  process.exit(1);
}
const webmPath = join(outDir, webm);
const palettePath = join(outDir, 'palette.png');
// 截取「结尾 4.5s」= 纯玩法段（跳过加载/标题/点 Start，保证前 3 秒就是核心动词 + 目标）
const TRIM = ['-sseof', '-4.5'];
execFileSync(FFMPEG, ['-y', ...TRIM, '-i', webmPath, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palettePath], { stdio: 'inherit' });
execFileSync(FFMPEG, ['-y', ...TRIM, '-i', webmPath, '-i', palettePath, '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', OUT_GIF], { stdio: 'inherit' });
console.log('gif →', OUT_GIF);
if (existsSync(OUT_GIF)) {
  const { statSync } = await import('node:fs');
  console.log('bytes', statSync(OUT_GIF).size);
}
rmSync(outDir, { recursive: true, force: true });
