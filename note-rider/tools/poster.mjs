// 生成 poster.jpg（1280×720）与 poster-1920.jpg（1920×1080）：
// 真实标题屏（canvas 场景 + 大标题贴纸字）隐藏选关/按钮后截图。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8154, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8154/');
await page.waitForTimeout(900);
// 隐藏选关网格/按钮/语言/星星计数，只留标题 + 骑士 + 五线谱
await page.evaluate(() => {
  for (const id of ['level-grid', 'btn-start', 'lang-select', 'stars-total']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
});
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'poster.jpg') });
await ctx.close();
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
