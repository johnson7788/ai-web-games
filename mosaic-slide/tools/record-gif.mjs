// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，3–6s 循环）。
// 注意：不用 page.video().saveAs()（并行环境会卡死）；用 ctx.close() 落盘后再读 webm 目录。
// 用法：node tools/record-gif.mjs [levelIndex] [seed] [stepMs]
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8148, r));

const levelIdx = Number(process.argv[2] ?? 0);   // L1（3×3，12 步，前 3 秒即见滑动动作）
const seed = Number(process.argv[3] ?? 5);
const stepMs = Number(process.argv[4] ?? 250);
const gifOut = join(ROOT, 'game.gif');
const tmpDir = join(ROOT, 'tests', 'artifacts', 'giftmp');

await mkdir(tmpDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(250);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

// 算解法（倒放缺口游走）
const sol = await page.evaluate(([lv, sd]) => {
  window.__ll.debug.startSeeded(lv, sd);
  const r = window.__ll.run();
  const seq = r._blankSeq.slice(0, r._scrambleDepth).reverse();
  return seq.map((cell) => ({ r: Math.floor(cell / r.state.cols), c: cell % r.state.cols }));
}, [levelIdx, seed]);
await page.waitForTimeout(200);

// 逐片滑动，录下「核心玩法动作」
for (const { r, c } of sol) {
  await page.evaluate(([rr, cc]) => { const run = window.__ll.run(); if (run && run.state.phase === 'playing') run.slide(rr, cc); }, [r, c]);
  await page.waitForTimeout(stepMs);
}
// 结算 + 点亮（约 1.2s）
await page.waitForTimeout(1200);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 取 webm（ctx.close() 已强制落盘）
const webm = readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm'); process.exit(1); }
const webmPath = join(tmpDir, webm);
const palette = join(tmpDir, 'palette.png');
console.log('webm:', webmPath);

try {
  execFileSync('ffmpeg', ['-y', '-i', webmPath, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-i', webmPath, '-i', palette, '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', gifOut], { stdio: 'inherit' });
  console.log('saved', gifOut);
} finally {
  await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}
process.exit(0);
