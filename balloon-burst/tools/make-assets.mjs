// 生成上线物料源图：poster.jpg / poster-1920.jpg / icon 源截图。
// 用法：node tools/make-assets.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
await new Promise((r) => server.listen(8178, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

// 标题屏海报（1280×720）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8178/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  await ctx.close();
}

// 海报高清版（1920×1080，dsf 1.5）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8178/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 92 });
  await ctx.close();
}

// 玩法截图（icon 源）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8178/');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.loadLevel(0); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(ROOT, 'tests/artifacts/icon-src.png') });
  await ctx.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('assets written: poster.jpg, poster-1920.jpg, tests/artifacts/icon-src.png');
process.exit(0);
