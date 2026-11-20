// tools/record-gif.mjs — 录制真实玩法 → ffmpeg 转 480×270 循环 game.gif。
// 前 3 秒必须见核心动词（按住倒水）+ 目标（水位线/水温窗）。
// 注意：不并行用 saveAs（会卡死）；ctx.close() 后再读 webm 目录。
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GIF_OUT = join(ROOT, 'game.gif');
const WEBM_DIR = join(ROOT, 'tests', 'artifacts', 'gif');
mkdirSync(WEBM_DIR, { recursive: true });

const { server, port } = await serve(ROOT, 8197);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: WEBM_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(300);

await page.click('#btn-start', { timeout: 15000 });
await page.waitForTimeout(500);
if (await page.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
  await page.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
}
await page.waitForTimeout(250);

const box = await page.locator('#canvas').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

async function pourOnce(holdMs) {
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
  await page.waitForTimeout(620);
}

// 第一单：长按到接近满（金圈 perfect + 涟漪）
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.waitForTimeout(1350);
await page.mouse.up();
await page.waitForTimeout(650);

// 再来两单（连击/高峰感）
await pourOnce(1200);
await pourOnce(1000);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const webm = readdirSync(WEBM_DIR).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('✗ 没有录制到 webm'); process.exit(1); }
const webmPath = join(WEBM_DIR, webm);
const palette = join(WEBM_DIR, 'palette.png');

execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'inherit' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-i', palette, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', GIF_OUT], { stdio: 'inherit' });

const kb = Math.round(statSync(GIF_OUT).size / 1024);
console.log('✓ game.gif', kb + 'KB', GIF_OUT);
if (kb > 2048) { console.error('⚠ game.gif 超过 2MB'); process.exit(1); }
process.exit(0);
