// tools/record-poster.mjs — 生成 poster.jpg（1280×720）：真实玩法图 + HTML 叠大标题/tagline
import { createServer } from 'node:http';
import { readFile, writeFile, rm } from 'node:fs/promises';
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
const port = 8300 + Math.floor(Math.random() * 500);
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(900);

// 跳到天鹅座，连 7/8 段（留最后一条线作目标张力），截玩法底图
await page.evaluate(() => {
  window.__ll.tutorial.skip();
  window.__ll.jump(8);
  const run = window.__ll.run;
  run.solution().forEach((s, i) => {
    if (i > 0) { run.step({ to: s.trail[0] }); }
    for (let k = 1; k < s.trail.length - 1; k += 1) run.step({ to: s.trail[k] });
  });
});
await page.waitForTimeout(350);
const base = await page.screenshot({ type: 'jpeg', quality: 92 });
await page.context().close();
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 叠标题的 HTML
const baseB64 = base.toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; background:#0c0824; font-family:'PingFang SC','Segoe UI',sans-serif; position:relative; overflow:hidden; }
img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.grad { position:absolute; inset:0; background:linear-gradient(180deg, rgba(8,5,24,0.0) 0%, rgba(8,5,24,0.55) 62%, rgba(8,5,24,0.9) 100%); }
.wrap { position:absolute; left:60px; bottom:56px; right:60px; }
h1 { color:#fff; font-size:88px; font-weight:800; letter-spacing:0.12em; line-height:1.02; text-shadow:0 0 24px rgba(183,166,255,0.95), 0 0 60px rgba(183,166,255,0.6), 0 2px 0 rgba(255,209,102,0.4); }
.tag { color:#efeaff; font-size:26px; margin-top:16px; letter-spacing:0.04em; text-shadow:0 0 14px rgba(183,166,255,0.8); }
</style></head><body>
<img class="bg" src="data:image/jpeg;base64,${baseB64}">
<div class="grad"></div>
<div class="wrap"><h1>CONSTELLATION LINE</h1><div class="tag">Trace every line once to light the sky.</div></div>
</body></html>`;

const posterHtml = join(ROOT, 'tests', 'artifacts', 'poster.html');
await writeFile(posterHtml, html);

const b2 = await chromium.launch();
const pg2 = await (await b2.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await pg2.goto('file://' + posterHtml, { waitUntil: 'load' });
await pg2.waitForTimeout(200);
await pg2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await b2.close().catch(() => {});
await rm(posterHtml, { force: true });
console.log('poster.jpg saved');
process.exit(0);
