// COLOR FLUX · 生成 poster.jpg（1280×720）：玩法截图 + 发光大标题 + tagline
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8157, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8157/');
await page.waitForTimeout(900);
await page.evaluate(() => { window.__ll.setLang('en'); window.__ll.start(); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.setAutoPlay(true));
await page.waitForTimeout(3200);

// 叠加海报标题层（发光描边大标题 + tagline）
await page.evaluate(() => {
  const d = document.createElement('div');
  d.id = 'poster-overlay';
  d.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:linear-gradient(180deg,rgba(5,6,15,0.55) 0%,rgba(5,6,15,0.05) 40%,rgba(5,6,15,0.65) 100%);z-index:100;pointer-events:none;';
  d.innerHTML =
    '<div style="font-size:96px;font-weight:800;letter-spacing:0.12em;color:#eaf6ff;text-shadow:0 0 24px rgba(77,184,255,0.95),0 0 60px rgba(127,107,255,0.8),0 2px 0 rgba(0,0,0,0.4);">COLOR FLUX</div>' +
    '<div style="margin-top:18px;font-size:26px;letter-spacing:0.06em;color:#9fd4ff;text-shadow:0 0 14px rgba(77,184,255,0.7);">Tap to bounce · Match the ring · Chain 10 for the aurora</div>';
  document.getElementById('game-container').appendChild(d);
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
