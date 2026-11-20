// BRICK BLITZ · 上线物料：poster.jpg(1280×720) / poster-1920.jpg(1920×1080) / 玩法原帧。
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
await new Promise((r) => server.listen(8151, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// poster.jpg：标题屏 1280×720
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  await ctx.close();
}

// poster-1920.jpg：标题屏 1920×1080
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 92 });
  await ctx.close();
}

// 玩法原帧（供 icon/favicon 裁切）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(0, 5);
    window.__ll.run().launch();
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(ROOT, 'tests/artifacts/poster-game.png') });
  await ctx.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg, poster-1920.jpg, tests/artifacts/poster-game.png');
process.exit(0);
