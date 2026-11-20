// tools/poster.mjs — 截一张最有张力的玩法图 + HTML 叠大标题（发光描边）+ tagline → poster.jpg（1280×720）
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
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8149, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8149/');
await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count() && await skip.isVisible()) { await skip.click({ force: true }); await page.waitForTimeout(400); }
// 红巨核场景 + 满钉布局：最有张力的玩法画面
await page.evaluate(() => { window.__ll.debug.jump(5); window.__ll.debug.pin(12); });
await page.waitForTimeout(400);

await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.innerHTML =
    '<div class="poster-title">ENDLESS ORB</div>' +
    '<div class="poster-tag">Pin photons into the spinning core</div>';
  document.getElementById('game-container').appendChild(ov);
  const st = document.createElement('style');
  st.textContent = `
    #poster-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:none;z-index:25;text-align:center;padding:0 40px}
    .poster-title{font-family:'Courier New',monospace;font-weight:800;font-size:92px;letter-spacing:.14em;color:#f0ffff;text-shadow:0 0 22px rgba(84,231,255,.95),0 0 60px rgba(84,231,255,.55),0 4px 0 rgba(3,18,30,.9)}
    .poster-tag{font-family:'Courier New',monospace;font-size:26px;letter-spacing:.06em;color:#eafaff;background:rgba(3,18,30,.62);padding:8px 22px;border-radius:999px;border:1px solid rgba(84,231,255,.5)}
  `;
  document.head.appendChild(st);
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
