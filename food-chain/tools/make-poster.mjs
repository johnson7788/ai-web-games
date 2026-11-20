// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：真实玩法图 + HTML 叠大标题（发光描边）+ tagline
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});

// 推进到阶段 3（礁石飞鱼），主角更大更亮，处于中层带交界的戏剧光色
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.mass = 120;
  r.step({ steerX: null, steerY: null });
});
await page.waitForTimeout(400);

// 叠大标题 + tagline
await page.evaluate(() => {
  const el = document.createElement('div');
  el.id = 'poster-overlay';
  el.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:70px;pointer-events:none;font-family:'Segoe UI','PingFang SC',sans-serif;">
      <div style="font-size:96px;font-weight:900;letter-spacing:0.16em;color:#eaffff;text-shadow:0 0 22px rgba(84,231,255,0.95),0 0 60px rgba(84,231,255,0.6),0 4px 0 rgba(4,16,24,0.85);">FOOD CHAIN</div>
      <div style="margin-top:14px;font-size:24px;letter-spacing:0.06em;color:#d9f4ff;text-shadow:0 0 14px rgba(84,231,255,0.9),0 2px 0 rgba(4,16,24,0.85);">Eat smaller. Grow bigger. Become the apex light.</div>
    </div>`;
  document.body.appendChild(el);
});
await page.waitForTimeout(300);

await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
