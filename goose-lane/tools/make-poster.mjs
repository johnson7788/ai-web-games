// tools/make-poster.mjs — 用一张最有张力的玩法图 + HTML 叠大标题 → poster.jpg（1280×720）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8148, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 720px; overflow: hidden; background: #14122e; }
  .bg { position: absolute; inset: 0; width: 1280px; height: 720px; object-fit: cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,8,30,0.25) 0%, rgba(10,8,30,0.05) 45%, rgba(10,8,30,0.75) 100%); }
  .wrap { position: absolute; left: 64px; bottom: 56px; font-family: 'Segoe UI', 'PingFang SC', system-ui, sans-serif; }
  .title { font-size: 118px; font-weight: 900; letter-spacing: 0.06em; color: #fff;
    text-shadow: 0 0 14px #ffb45c, 0 0 34px rgba(255,180,92,0.8), 0 0 70px #8f7dff, 0 4px 10px rgba(0,0,0,0.6); }
  .tagline { margin-top: 18px; font-size: 28px; letter-spacing: 0.04em; color: #ffe9a8; font-weight: 600;
    text-shadow: 0 2px 6px rgba(0,0,0,0.7); }
</style></head><body>
  <img class="bg" src="http://127.0.0.1:8148/tests/final/05-night.png">
  <div class="shade"></div>
  <div class="wrap"><div class="title">GOOSE LANE</div><div class="tagline">Dodge. Grab. Ride the smooth transfer.</div></div>
</body></html>`);
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
