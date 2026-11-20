// 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline。
// 用法：node tools/make-poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
await new Promise((r) => server.listen(8292, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8292/');
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 8000 });
await page.evaluate(() => {
  window.__ll.start();
  window.__ll.tutorial.skip();
});
// 自动驾驶推进到「正在穿落/陨石」的张力画面
await page.evaluate(() => {
  window.__poster = setInterval(() => {
    const r = window.__ll.run;
    if (r && r.phase === 'playing') r.auto(2);
  }, 60);
});
await page.waitForTimeout(2600);
await page.evaluate(() => clearInterval(window.__poster));
const shot = await page.screenshot();
await page.close();

// 叠标题 → poster.jpg
const overlay = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const b64 = shot.toString('base64');
await overlay.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 720px; overflow: hidden; font-family: 'PingFang SC','Segoe UI','Helvetica Neue',Arial,sans-serif; }
  .stage { position: relative; width: 1280px; height: 720px; background: #0b0406; }
  .bg { position: absolute; inset: 0; width: 1280px; height: 720px; object-fit: cover; }
  .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,2,4,0.0) 0%, rgba(6,2,4,0.18) 55%, rgba(6,2,4,0.82) 100%); }
  .copy { position: absolute; left: 60px; right: 60px; bottom: 54px; }
  .title {
    font-size: 104px; font-weight: 900; letter-spacing: 0.06em; color: #fff6e8; line-height: 1;
    text-shadow: 0 0 18px rgba(255,138,61,0.95), 0 0 46px rgba(255,90,42,0.7), 0 4px 0 rgba(80,20,8,0.9);
  }
  .tagline {
    margin-top: 20px; font-size: 26px; letter-spacing: 0.04em; color: #ffd9a0;
    text-shadow: 0 0 12px rgba(255,138,61,0.8), 0 2px 0 rgba(60,12,4,0.9);
  }
</style></head><body>
  <div class="stage">
    <img class="bg" src="data:image/png;base64,${b64}" alt="">
    <div class="veil"></div>
    <div class="copy">
      <div class="title">HELIX ORBIT</div>
      <div class="tagline">Rotate the volcano · Drop through the gaps · Become the meteor</div>
    </div>
  </div>
</body></html>`);
await overlay.waitForTimeout(200);
await overlay.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
