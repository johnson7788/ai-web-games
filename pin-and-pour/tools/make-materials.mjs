// 产出上线物料：poster.jpg（1280×720）/ poster-1920.jpg（1920×1080）/ icon-src.png（画布标题场景）
// 用法：node tools/make-materials.mjs
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

const browser = await chromium.launch();
const base = 'http://127.0.0.1:8151/';

// 干净标题屏（隐藏关卡格/按钮/星级/语言，只留标题+副标题+场景）
async function cleanTitle(page) {
  await page.evaluate(() => {
    for (const id of ['level-grid', 'btn-start', 'stars-total', 'lang-select']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    document.querySelector('.total-stars')?.style.setProperty('display', 'none');
    if (window.__drawTitle) window.__drawTitle();
  });
}

// poster.jpg 1280×720
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700);
await cleanTitle(page);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
await page.close();

// poster-1920.jpg 1920×1080（DPR 1.5 放大，保持锐利）
page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700);
await cleanTitle(page);
await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 92 });
await page.close();

// icon-src：只留画布标题场景（隐藏所有 DOM 覆盖层）
page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(() => {
  for (const s of document.querySelectorAll('.screen, #hud')) s.style.display = 'none';
  if (window.__drawTitle) window.__drawTitle();
});
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'icon-src.png') });
await page.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg, poster-1920.jpg, tests/artifacts/icon-src.png');
process.exit(0);
