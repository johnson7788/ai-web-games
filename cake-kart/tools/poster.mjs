// tools/poster.mjs — 玩法截图 + HTML 叠大标题（发光描边）→ poster.jpg（1280×720）。
// 用法：node tools/poster.mjs
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
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8167/');
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.tutorial.skip());

// 进入最有张力的漂移画面：满油 + 转向 + 漂移蓄力
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(700);
await page.keyboard.down('ArrowRight');
await page.keyboard.down('Shift');
await page.waitForTimeout(1200);
const shot = await page.screenshot({ type: 'png' });
const base64 = shot.toString('base64');
await page.keyboard.up('Shift');
await page.keyboard.up('ArrowRight');
await page.keyboard.up('ArrowUp');

// HTML 叠字
await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:'PingFang SC','Segoe UI',sans-serif;}
  .bg{position:absolute;inset:0;background:url(data:image/png;base64,${base64}) center/cover no-repeat;}
  .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(42,15,30,0.05) 0%,rgba(42,15,30,0.35) 60%,rgba(42,15,30,0.72) 100%);}
  .title{position:absolute;left:70px;top:86px;font-size:96px;font-weight:800;letter-spacing:0.08em;color:#fff7fb;
    text-shadow:0 0 18px rgba(255,46,126,0.95),0 0 46px rgba(255,46,126,0.6),0 4px 0 #6d2a4a;}
  .tag{position:absolute;left:74px;top:210px;font-size:26px;color:#ffd166;letter-spacing:0.1em;
    text-shadow:0 0 12px rgba(255,209,102,0.7),0 2px 0 rgba(42,15,30,0.6);}
  .sub{position:absolute;left:74px;top:254px;font-size:18px;color:#ffeaf3;letter-spacing:0.04em;opacity:0.9;}
</style></head><body>
  <div class="bg"></div><div class="veil"></div>
  <div class="title">CAKE KART</div>
  <div class="tag">FONDANT GRAND PRIX</div>
  <div class="sub">Frosting drift · Sweet weapons · Win the race</div>
</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
