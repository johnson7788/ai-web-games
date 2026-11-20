// 上线物料：poster.jpg(1280×720) / poster-1920.jpg(1920×1080) / icon.png(256) / favicon.png(64)
// 从真实标题屏与玩法画面截图，再经 ffmpeg 裁切缩放。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8148, r));

const URL = 'http://127.0.0.1:8148/';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

// 海报 1280×720（标题屏）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}
// 海报 1920×1080
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}
// 玩法画面（图标素材）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.start(0); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', '_icon-src.png') });
  await ctx.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();

execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', join(ROOT, 'tests/artifacts/_icon-src.png'),
  '-vf', 'scale=256:256:force_original_aspect_ratio=increase,crop=256:256', join(ROOT, 'icon.png')], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', join(ROOT, 'icon.png'), '-vf', 'scale=64:64', join(ROOT, 'favicon.png')], { stdio: 'ignore' });
console.log('materials done: poster.jpg, poster-1920.jpg, icon.png, favicon.png');
