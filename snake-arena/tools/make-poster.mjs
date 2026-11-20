// SNAKE ARENA · 生成海报 poster.jpg（1280×720）
// 做法：截一张真实玩法图（玩家吃数据点后）→ HTML 叠大标题（发光描边）+ tagline → playwright 截图存 jpg。
// 用法：node tools/make-poster.mjs [outJpg]   （默认写仓库根 poster.jpg）
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const outJpg = process.argv[2] ? join(ROOT, process.argv[2]) : join(ROOT, 'poster.jpg');
const tmpDir = join(ROOT, '.poster-tmp');
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(300);
await page.click('#btn-start', { force: true });
await page.waitForTimeout(600);
await page.click('[data-tutorial-skip]', { force: true }).catch(() => {});

// 吃几个数据点，让玩家蛇有一段可见长度、画面更「在玩」
const foods = await page.evaluate(() => (window.__ll.run ? window.__ll.run.foods.slice(0, 5).map((f) => ({ x: f.x, y: f.y })) : []));
const rect = await page.evaluate(() => {
  const r = document.getElementById('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, scaleX: 1280 / r.width, scaleY: 720 / r.height };
});
for (const f of foods) {
  await page.mouse.move(rect.left + f.x / rect.scaleX, rect.top + f.y / rect.scaleY, { steps: 4 });
  await page.waitForTimeout(420);
}

const basePng = join(tmpDir, 'base.png');
await page.screenshot({ path: basePng });
const baseB64 = readFileSync(basePng).toString('base64');

// HTML 叠字：发光大标题 + tagline，然后截图存 jpg
const overlayHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden;background:#02050d;font-family:'PingFang SC','Segoe UI',sans-serif;}
  .bg{position:absolute;inset:0;}
  .bg img{width:1280px;height:720px;display:block;}
  .veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%, rgba(2,5,13,0.05) 0%, rgba(2,5,13,0.55) 78%);}
  .title-wrap{position:absolute;left:0;right:0;top:196px;text-align:center;color:#eaf9ff;}
  .logo{font-size:104px;font-weight:800;letter-spacing:0.18em;line-height:1;
    text-shadow:0 0 22px rgba(56,189,248,0.9),0 0 60px rgba(56,189,248,0.5),0 2px 0 rgba(2,5,13,0.8);}
  .tagline{margin-top:26px;font-size:30px;letter-spacing:0.32em;color:#7dd3fc;
    text-shadow:0 0 16px rgba(56,189,248,0.7),0 2px 0 rgba(2,5,13,0.8);}
</style></head><body>
  <div class="bg"><img src="data:image/png;base64,${baseB64}"></div>
  <div class="veil"></div>
  <div class="title-wrap"><div class="logo">SNAKE ARENA</div><div class="tagline">STEER · BOOST · CUT THEM DOWN</div></div>
</body></html>`;

const ov = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await ov.setContent(overlayHtml, { waitUntil: 'load' });
await ov.waitForTimeout(300);
await ov.screenshot({ path: outJpg, type: 'jpeg', quality: 90 });

await page.close().catch(() => {});
await ov.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
rmSync(tmpDir, { recursive: true, force: true });

const kb = Math.round(readFileSync(outJpg).length / 1024);
console.log('poster.jpg:', kb + 'KB');
console.log('saved', outJpg);
process.exit(0);
