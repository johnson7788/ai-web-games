// tools/make-poster.mjs — 截一张最有张力的玩法图，叠大标题+tagline，存 poster.jpg（1280×720）。
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8149/');
await page.waitForTimeout(800);

// 进入玩法并打出几次爆破，让棋盘与粒子更有张力
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(1, 42);
});
await page.waitForTimeout(400);
for (let i = 0; i < 4; i += 1) {
  await page.evaluate(() => window.__ll.debug.popLargest());
  await page.waitForTimeout(420);
}

// 在实时画面上叠大标题（发光描边）+ tagline
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:none;';
  ov.innerHTML =
    '<div style="font:900 96px/1 \'Segoe UI\',\'PingFang SC\',sans-serif;color:#fff;letter-spacing:0.14em;' +
    'text-shadow:0 0 18px #b06cff,0 0 44px #b06cff,0 3px 0 #3a1f63,0 -1px 0 rgba(0,0,0,.6);">GEM CASCADE</div>' +
    '<div style="font:600 26px/1.4 \'Segoe UI\',\'PingFang SC\',sans-serif;color:#f0e6ff;letter-spacing:0.08em;' +
    'text-shadow:0 2px 10px rgba(0,0,0,.8),0 0 16px #b06cff;">Blast the vein · Charge the pickaxe · Chain a cave-in</div>';
  document.getElementById('ui-root').appendChild(ov);
});
await page.waitForTimeout(250);

await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
console.log('saved', join(ROOT, 'poster.jpg'));

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
process.exit(0);
