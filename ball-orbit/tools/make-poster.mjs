// tools/make-poster.mjs — 生成 poster.jpg（1280×720）
// 截一张最有张力的玩法图 → HTML 叠大标题（发光描边）+ tagline → playwright 截图存 jpg。
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

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

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 1) 玩法截图
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('ball-orbit:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.run.step({ aimAngle: 0.16, fire: true }));
await page.waitForTimeout(2400);
const bgPath = join(ROOT, 'tests', 'artifacts', 'poster-bg.png');
await page.screenshot({ path: bgPath });
await ctx.close();

// 2) HTML 叠字 → poster.jpg
const posterHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden;font-family:'PingFang SC','Segoe UI',sans-serif;}
.wrap{position:relative;width:1280px;height:720px;background:#05060c;}
.bg{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;}
.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,12,0.15) 0%,rgba(5,6,12,0) 42%,rgba(5,6,12,0.78) 100%);}
.title{position:absolute;top:36px;left:0;right:0;text-align:center;font-size:88px;font-weight:900;letter-spacing:0.16em;color:#eaffff;text-shadow:0 0 14px rgba(127,214,255,0.9),0 0 42px rgba(127,214,255,0.55),0 3px 0 rgba(0,0,0,0.55);}
.tag{position:absolute;bottom:64px;left:0;right:0;text-align:center;font-size:27px;letter-spacing:0.05em;color:#ffe9c2;text-shadow:0 0 12px rgba(255,207,106,0.7),0 2px 6px rgba(0,0,0,0.8);}
</style></head><body>
<div class="wrap">
<img class="bg" src="tests/artifacts/poster-bg.png">
<div class="veil"></div>
<div class="title">BALL ORBIT</div>
<div class="tag">Slingshot meteors · Bend around planets · Shatter the belt</div>
</div>
</body></html>`;
const posterHtmlPath = join(ROOT, 'tests', 'artifacts', 'poster.html');
await writeFile(posterHtmlPath, posterHtml);

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:8148/tests/artifacts/poster.html', { waitUntil: 'load', timeout: 30000 });
await p2.waitForTimeout(300);
await p2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await ctx2.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
