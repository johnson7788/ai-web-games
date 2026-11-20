// 录制真实玩法 → webm（再用 ffmpeg palettegen/paletteuse 转 game.gif）
// 用法：node tools/record-gif.mjs [out.webm]
// 关键：用 ctx.close() 冲刷录屏后再读 webm 目录，避免 saveAs 在并行环境卡死。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, process.argv[2] || 'tests/artifacts/gameplay.webm');
const REC_DIR = dirname(OUT);
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
await new Promise((r) => server.listen(8147, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: REC_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(700);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count()) { await skip.click({ force: true }).catch(() => {}); }
await page.waitForTimeout(300);

// 快进到 A 轮（约 ¥100K），让 HUD 显示有分量的估值与进度，营销物料更抓眼
await page.evaluate(() => {
  const r = window.__ll.run;
  let g = 0;
  while (r.phase === 'playing' && r.round < 3 && g < 30000) {
    r.click();
    r.buyUpgrade('tap');
    r.buyUpgrade('auto');
    r.step();
    r.drainEvents();
    g += 1;
  }
  r.burn.cooldownRemaining = 0;
  r.bet = -1;
  r.drainEvents();
});

// 真实玩法片段：连续点击 + 烧钱 + 押注（约 4.5s）
await page.click('#btn-burn');
for (let i = 0; i < 26; i += 1) {
  await page.click('#btn-tap');
  await page.waitForTimeout(95);
}
await page.click('#sector-0');
await page.waitForTimeout(600);
await page.click('#up-tap');
await page.waitForTimeout(600);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ctx.close() 已冲刷 webm 到 REC_DIR；把最新 webm 重命名为 out
const files = (await readdir(REC_DIR)).filter((f) => f.endsWith('.webm')).sort();
const latest = files[files.length - 1];
if (!latest) {
  console.error('no webm recorded');
  process.exit(1);
}
renameSync(join(REC_DIR, latest), OUT);
console.log('saved', OUT);
process.exit(0);
