// tools/poster.mjs — 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题/副标 → jpg。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    await stat(file);
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8148, r));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const html = `<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; }
  body { width:1280px; height:720px; overflow:hidden; background:#0b0614; font-family:'Segoe UI','PingFang SC',sans-serif; }
  .bg { position:absolute; inset:0; }
  .bg img { width:1280px; height:720px; object-fit:cover; }
  .scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(11,6,20,0.15) 0%, rgba(11,6,20,0.05) 40%, rgba(11,6,20,0.72) 100%); }
  .title-wrap { position:absolute; left:0; right:0; bottom:44px; text-align:center; }
  h1 { font-size:96px; font-weight:900; letter-spacing:0.14em; color:#fff;
       text-shadow:0 0 18px #ff4fd8, 0 0 46px #ff4fd8, 0 0 90px #7fe7ff, 0 4px 6px rgba(0,0,0,0.6); }
  .tag { margin-top:10px; font-size:26px; letter-spacing:0.12em; color:#ffe9fb;
         text-shadow:0 0 14px rgba(255,79,216,0.9), 0 2px 4px rgba(0,0,0,0.7); }
  .zh { margin-top:6px; font-size:20px; letter-spacing:0.3em; color:#ffc94a; text-shadow:0 0 12px rgba(255,201,74,0.8); }
</style></head><body>
  <div class="bg"><img src="http://127.0.0.1:8148/tests/final/04-selected.png"></div>
  <div class="scrim"></div>
  <div class="title-wrap">
    <h1>CARD LORD</h1>
    <div class="tag">CYBER LANDLORD · BID · DOUBLE · BLAST BOMBS</div>
    <div class="zh">赛博牌局 · 斗地主单机</div>
  </div>
</body></html>`;
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
