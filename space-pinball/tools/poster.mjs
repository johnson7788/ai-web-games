// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法画面 + 大标题发光描边 + tagline
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8262;
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
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);

await page.click('#btn-start');
await page.waitForTimeout(500);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
await page.waitForTimeout(200);
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let k = 0; k < 40; k += 1) r.step({ launch: true });
  r.step({ launch: false });
  for (let k = 0; k < 30; k += 1) r.step({ left: false, right: false, launch: false, nudge: 0 });
  r.supernovaT = 10;
  r.stars.forEach((s) => { s.lit = true; });
  r.reactorLights = 3;
});
await page.waitForTimeout(400);

await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:50;';
  ov.innerHTML =
    '<div style="font:900 86px/1 \'PingFang SC\',\'Segoe UI\',sans-serif;letter-spacing:0.12em;color:#eafcff;' +
    'text-shadow:0 0 18px #41e6ff,0 0 42px #5c7cff,0 0 70px #41e6ff;">SPACE PINBALL</div>' +
    '<div style="margin-top:18px;font:600 26px/1.3 \'PingFang SC\',\'Segoe UI\',sans-serif;color:#cfefff;letter-spacing:0.05em;' +
    'text-shadow:0 0 12px #41e6ff;">Charge the plunger · Ignite the reactor core</div>';
  document.body.appendChild(ov);
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 82 });

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
