// tools/make-poster.mjs — 最有张力的玩法帧 → 叠大标题+tagline → 截图存 poster.jpg（1280×720）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

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
await new Promise((r) => server.listen(8148, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 12000 });

// 7×7 霓虹管场景，先点几步让盘面更有张力
await page.evaluate(() => { window.__ll.startLevel(24); window.__ll.tutorial.skip(); });
await page.waitForTimeout(300);
await page.evaluate(() => { const r = window.__ll.run; for (let i = 0; i < 4 && i < r.solution.length; i += 1) r.press(r.solution[i][0], r.solution[i][1]); });
await page.waitForTimeout(250);

// 叠大标题 + tagline（发光描边），半透明遮罩露出背后棋盘
await page.evaluate(() => {
  const el = document.createElement('div');
  el.id = 'poster-overlay';
  el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:radial-gradient(circle at 50% 45%, rgba(3,12,8,0.10) 0%, rgba(3,12,8,0.66) 78%);z-index:50;pointer-events:none;';
  el.innerHTML =
    '<div style="font:800 84px/1 \'Courier New\',monospace;letter-spacing:0.18em;color:#eafff2;text-shadow:0 0 18px rgba(92,255,157,0.95),0 0 48px rgba(92,255,157,0.5),0 4px 0 rgba(0,0,0,0.4);">LIGHT GRID</div>' +
    '<div style="font:600 26px/1.3 \'PingFang SC\',\'Segoe UI\',monospace;letter-spacing:0.10em;color:#c6ff6a;text-shadow:0 0 12px rgba(198,255,106,0.7);">Power every node. Beat the fuse.</div>';
  document.getElementById('game-container').appendChild(el);
});
await page.waitForTimeout(120);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', OUT);
process.exit(0);
