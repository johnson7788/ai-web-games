// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270）。
// 用法：node tools/record-gif.mjs
import { readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { server, port } = await serve(ROOT, 8148);

const tmpDir = resolve(ROOT, 'tests/artifacts/gif-tmp');
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 15000 });
await page.waitForTimeout(300);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(300);

// 自动试玩：每 90ms 一次贪婪交换/下挖，让画面持续出现「交换→消除→收集→下挖」真实循环
await page.evaluate(() => {
  window.__gifBot = setInterval(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing') return;
    if (r.canDig()) r.step({ dig: true });
    else { const s = r.findSwap(true) || r.findSwap(false); if (s) r.step({ swap: s }); }
    r.drainEvents();
  }, 90);
});
await page.waitForTimeout(4600);
await page.evaluate(() => clearInterval(window.__gifBot));

// 关键：先 ctx.close() 把 webm 落盘，再读目录（saveAs 并行环境会卡死）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webm = readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
const webmPath = join(tmpDir, webm);
const gifOut = join(ROOT, 'game.gif');
const palette = join(tmpDir, 'palette.png');

const ff = '/opt/homebrew/bin/ffmpeg';
function runFf(args) {
  const r = spawnSync(ff, args, { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed:', args.join(' ')); process.exit(1); }
}
// 跳过标题/开屏（约前 1.6s），截取 4.5s 真实玩法窗口
const SS = '1.6';
const DUR = '4.5';
runFf(['-y', '-ss', SS, '-t', DUR, '-i', webmPath, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen', palette]);
runFf(['-y', '-ss', SS, '-t', DUR, '-i', webmPath, '-i', palette, '-filter_complex', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', gifOut]);

console.log('saved game.gif');
process.exit(0);
