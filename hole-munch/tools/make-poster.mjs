// 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline。
// 用法：node tools/make-poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8177, r));

const browser = await chromium.launch();

// 1) 真实玩法帧：播种开局，追吃 3.5s（洞变大、周围有可吞物）
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8177/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone();
  window.__ll.debug.startSeeded(42);
});
for (let i = 0; i < 15; i += 1) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing' || !r.player.alive) return;
    let best = null; let bestD = Infinity;
    for (const o of r.objects) {
      if (o.r >= r.player.r * 0.9) continue;
      const d = Math.hypot(o.x - r.player.x, o.y - r.player.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) window.__ll.debug.steerWorld(best.x, best.y);
  });
  await page.waitForTimeout(240);
}
const frame = await page.screenshot({ type: 'png' });
await ctx.close();

// 2) HTML 叠标题
const base64 = frame.toString('base64');
const posterHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:720px;background:#0c0416;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;overflow:hidden}
.bg{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover}
.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,4,22,0.06) 0%,rgba(12,4,22,0.28) 46%,rgba(12,4,22,0.82) 100%)}
.title{position:absolute;left:64px;right:64px;bottom:96px;color:#fff;text-align:left}
.logo{font-size:96px;font-weight:900;letter-spacing:0.04em;line-height:1;color:#7ef0ff;
  text-shadow:0 0 18px rgba(126,240,255,0.95),0 0 42px rgba(126,240,255,0.55),0 4px 22px rgba(0,0,0,0.9);
  -webkit-text-stroke:2px rgba(12,4,22,0.55)}
.tag{font-size:28px;font-weight:600;color:#ffd98a;margin-top:14px;letter-spacing:0.02em;
  text-shadow:0 2px 12px rgba(0,0,0,0.9)}
.sub{font-size:18px;color:#cfe6ef;margin-top:8px;opacity:0.92;text-shadow:0 1px 8px rgba(0,0,0,0.9)}
</style></head><body>
<img class="bg" src="data:image/png;base64,${base64}">
<div class="veil"></div>
<div class="title">
  <div class="logo">HOLE MUNCH</div>
  <div class="tag">Swallow the midnight city. Grow. Out-eat 5 rival holes.</div>
  <div class="sub">Drag to move · Eat what's smaller · Top 3 in 2 minutes</div>
</div>
</body></html>`;
writeFileSync(join(ROOT, 'tests/artifacts/poster.html'), posterHtml);

const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ppage = await pctx.newPage();
await ppage.setContent(posterHtml);
await ppage.waitForTimeout(200);
await ppage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await pctx.close();

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
