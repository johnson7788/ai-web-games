// 生成上线海报：poster.jpg（1280×720）+ poster-1920.jpg（1920×1080）。
// 取真实标题屏（canvas 里的玫瑰花窗英雄图 + DOM 大标题贴纸字），隐藏非营销 UI 后截图。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
await new Promise((r) => server.listen(8149, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

async function shot(dpr, out) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8149/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(900);
  // 隐藏非营销 UI，保留标题/副标题/Start + 花窗英雄图
  await page.evaluate(() => {
    for (const id of ['lang-select', 'level-grid', 'stars-total']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(ROOT, out), animations: 'disabled' });
  await ctx.close().catch(() => {});
  console.log('saved', out);
}

await shot(1, 'poster.jpg');
await shot(1.5, 'poster-1920.jpg');

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
process.exit(0);
