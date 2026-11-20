// tools/record-gif.mjs — 录真实玩法 → webm → ffmpeg 转 game.gif（480×270，≤2MB）
// 用 recordVideo 录屏；录制结束用 ctx.close() 再读 webm 目录（避开 saveAs 并行卡死坑）。
import { readdirSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();

const { server, port } = await serve(ROOT, 8157);

const videoDir = join(ROOT, 'tools', 'artifacts', 'gifsrc');
rmSync(videoDir, { recursive: true, force: true });
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 });

await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(180);
await page.evaluate(() => { const el = document.querySelector('[data-tutorial-skip]'); if (el) el.click(); });
await page.evaluate(() => { window.__ll.debug.autopilot = true; });
await page.waitForTimeout(4300);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.close();

const files = readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
if (!files.length) {
  console.error('no webm captured');
  process.exit(1);
}
const webm = join(videoDir, files[0]);
const gif = join(ROOT, 'game.gif');
const palette = join(videoDir, 'palette.png');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '0.25', '-t', '4.4', '-i', webm, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '0.25', '-t', '4.4', '-i', webm, '-i', palette, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', gif], { stdio: 'ignore' });

const kb = Math.round(statSync(gif).size / 1024);
console.log('saved', gif, `${kb}KB`);
process.exit(0);
