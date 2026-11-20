// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：真实玩法图 + 发光大标题叠字。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve } from 'node:path';
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
await new Promise((r) => server.listen(8153, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

await page.goto('http://127.0.0.1:8153/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.setItem('spot-it:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(500);

// 找两个目标，画面有内容 + 市场点亮前的张力
for (let i = 0; i < 2; i += 1) {
  const t = await page.evaluate(() => {
    const r = window.__ll.run;
    const x = r && r.items.find((it) => it.isTarget && !it.found);
    return x ? { x: x.x, y: x.y } : null;
  });
  if (!t) break;
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(350);
}
const baseBuf = await page.screenshot({ type: 'png' });
await browser.close();
server.closeAllConnections?.();
server.close();

const b64 = baseBuf.toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1280px;height:720px;overflow:hidden;background:#0c0f14;font-family:'PingFang SC','Segoe UI','Microsoft YaHei',monospace;}
.bg{position:absolute;inset:0;background:url(data:image/png;base64,${b64}) center/cover no-repeat;filter:brightness(0.9);}
.scrim{position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,rgba(12,15,20,0.06) 0%,rgba(12,15,20,0.82) 100%);}
.title-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
h1{font-size:118px;font-weight:800;letter-spacing:0.18em;color:#fff6df;text-shadow:0 0 18px rgba(255,214,106,0.95),0 0 48px rgba(255,214,106,0.55),0 4px 0 #3a2a10;}
.tag{margin-top:18px;font-size:26px;color:#ffe9b0;letter-spacing:0.08em;text-shadow:0 2px 8px rgba(0,0,0,0.9);}
</style></head><body>
<div class="bg"></div><div class="scrim"></div>
<div class="title-wrap"><h1>SPOT IT</h1><div class="tag">Sweep the light. Find the goods. Light the market.</div></div>
</body></html>`;

const tmp = join(ROOT, 'tests/artifacts/poster.html');
writeFileSync(tmp, html);

const b2 = await chromium.launch({ headless: true });
const p2 = await (await b2.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p2.goto('file://' + tmp);
await p2.waitForTimeout(400);
await p2.screenshot({ path: resolve(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await b2.close();
console.log('poster.jpg written to', resolve(ROOT, 'poster.jpg'));
