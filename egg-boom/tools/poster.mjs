// 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8161, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8161/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase === 'title', { timeout: 15000 });
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.jumpLevel(5)); // 甜品站（粉，最出片）
await page.waitForTimeout(1200);
await page.evaluate(() => window.__ll.debug.testJump());
await page.waitForTimeout(500);
const shot = await page.screenshot({ type: 'png' });

// 叠大标题 + tagline，再截成 jpg
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  body { width:1280px; height:720px; overflow:hidden; position:relative; background:#000; }
  img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:86px; }
  .logo { font: 900 108px/1 'PingFang SC','Arial Black',system-ui,sans-serif; color:#fff7e6; letter-spacing:0.08em;
    text-shadow: 0 4px 0 #c87f3a, 0 0 24px rgba(255,201,74,.9), 0 0 60px rgba(255,140,60,.6), 0 6px 18px rgba(0,0,0,.5); }
  .tagline { margin-top:16px; font: 700 30px/1.4 'PingFang SC',system-ui,sans-serif; color:#fff; letter-spacing:0.04em;
    text-shadow: 0 2px 6px rgba(0,0,0,.6); background:rgba(60,30,10,.45); padding:8px 22px; border-radius:999px; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${shot.toString('base64')}">
  <div class="overlay">
    <div class="logo">EGG BOOM</div>
    <div class="tagline">Roll · Jump · Shoot — crack every dough</div>
  </div>
</body></html>`;

const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page2.setContent(html);
await page2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
