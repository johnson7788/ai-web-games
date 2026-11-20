// tools/record-gif.mjs — 录制真实玩法 webm → ffmpeg paletteuse → game.gif（480×270 / 4.5s）。
// 用法：/opt/homebrew/bin/node tools/record-gif.mjs
// 录制策略：开启 __ll.debug.setAutoplay(true)，让 greedy 玩家与 AI 自动对局 5s（真实摸打/弃牌/碰杠画面）。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = path.resolve('.');
const tmpDir = path.join(ROOT, 'tests/artifacts');
mkdirSync(tmpDir, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8461);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.setAutoplay(true));
await page.waitForTimeout(5200);

// saveAs 在部分环境会卡死：先关 context 落盘，再读 webm 目录
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const webm = readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('no webm recorded');
  process.exit(1);
}
const webmPath = path.join(tmpDir, webm);
const palette = path.join(tmpDir, 'palette.png');
const ff = '/opt/homebrew/bin/ffmpeg';

execSync(`${ff} -y -t 4.5 -i "${webmPath}" -vf "fps=30,scale=480:270:flags=lanczos,palettegen" "${palette}"`, { stdio: 'pipe' });
execSync(`${ff} -y -t 4.5 -i "${webmPath}" -i "${palette}" -lavfi "fps=30,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse" -loop 0 "${path.join(ROOT, 'game.gif')}"`, { stdio: 'pipe' });

console.log('saved game.gif');
process.exit(0);
