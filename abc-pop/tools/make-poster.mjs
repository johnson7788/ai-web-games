// 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline。
// 用法：node tools/make-poster.mjs
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8166, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

// 1) 截一张有张力的玩法图：雨后彩虹场景（字母 J）
await page.goto('http://127.0.0.1:8166/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 15000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
try { await page.click('[data-tutorial-skip]', { timeout: 3000 }); } catch { /* 无引导 */ }
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.jump(9, 0));
await page.waitForTimeout(500);
const bgPath = '/tmp/abc-pop-poster-bg.png';
await page.screenshot({ path: bgPath });
const bgB64 = (await readFile(bgPath)).toString('base64');

// 2) HTML 叠大标题 + tagline
await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  html,body { width:1280px; height:720px; overflow:hidden; }
  .bg { position:absolute; inset:0; background:url(data:image/png;base64,${bgB64}) center/cover no-repeat; }
  .veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(91,43,69,0.34) 100%); }
  .title-wrap { position:absolute; left:0; right:0; top:56px; text-align:center; }
  .logo { font-family:'PingFang SC','Segoe UI',sans-serif; font-weight:900; font-size:150px; letter-spacing:0.06em; color:#fff;
    text-shadow: 0 4px 0 #e05a86, 0 0 22px #ff8fb3, 0 0 46px rgba(255,143,179,0.9), 0 10px 30px rgba(91,43,69,0.55); }
  .tagline { font-family:'PingFang SC','Segoe UI',sans-serif; font-weight:700; font-size:34px; color:#fff; margin-top:14px;
    text-shadow: 0 2px 0 rgba(224,90,134,0.9), 0 4px 16px rgba(91,43,69,0.6); }
</style></head><body>
  <div class="bg"></div><div class="veil"></div>
  <div class="title-wrap"><div class="logo">ABC POP</div><div class="tagline">Pop the letter bubbles in a candy sky!</div></div>
</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

await browser.close();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
