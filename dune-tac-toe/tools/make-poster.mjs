// 生成上线物料：poster.jpg (1280×720) / poster-1920.jpg (1920×1080) / icon.png (256) / favicon.png (32)。
// 标题屏真实画面（沙漠场景 + 仙人掌/蝎子 + 大标题贴纸字）→ Playwright 截图。
// 图标从真实棋盘画面裁切（含仙人掌 + 蝎子棋子）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// 1) 海报：标题屏（隐藏按钮，只留大标题 + 副标题 + 场景 + 棋子）
async function shootPoster() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8148/');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    for (const id of ['btn-start', 'btn-puzzle', 'btn-endless', 'record-text', 'lang-select']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}

// 2) 1920×1080 海报：deviceScaleFactor 1.5 放大同一标题屏
async function shootPoster1920() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8148/');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    for (const id of ['btn-start', 'btn-puzzle', 'btn-endless', 'record-text', 'lang-select']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}

// 3) 图标源图：真实棋盘（L3 有仙人掌+蝎子），裁切棋盘区域
async function shootIconSource() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8148/');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.startSeeded(2, 3); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(ROOT, 'tests/artifacts/icon-source.png') });
  await ctx.close();
}

await shootPoster();
await shootPoster1920();
await shootIconSource();

await browser.close();
server.closeAllConnections?.();
server.close();

// 从棋盘区域裁切图标：grid=(400,142) 480×480 → 256 / 32
try {
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'tests/artifacts/icon-source.png'), '-vf', 'crop=480:480:400:142,scale=256:256:flags=lanczos', join(ROOT, 'icon.png')], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'tests/artifacts/icon-source.png'), '-vf', 'crop=480:480:400:142,scale=32:32:flags=lanczos', join(ROOT, 'favicon.png')], { stdio: 'inherit' });
  console.log('saved poster.jpg / poster-1920.jpg / icon.png / favicon.png');
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
