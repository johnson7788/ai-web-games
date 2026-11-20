// 海报生成：真实标题屏（含演示决斗场景）+ 大标题 → Playwright 截图。
// 用法：node tools/make-poster.mjs
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
await new Promise((r) => server.listen(8150, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function shot(w, h, out) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8150/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll, { timeout: 10000 });
  await page.waitForTimeout(900);
  // 隐藏菜单杂物，只留标题 + 副标题 + 开始按钮（海报更干净）
  await page.evaluate(() => {
    for (const id of ['level-grid', 'stars-total', 'lang-select']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    const sub = document.getElementById('subtitle-text');
    if (sub) sub.style.maxWidth = '760px';
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(ROOT, out) });
  await ctx.close();
  console.log('saved', out, `${w}x${h}`);
}

await shot(1280, 720, 'poster.jpg');
await shot(1920, 1080, 'poster-1920.jpg');

await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
