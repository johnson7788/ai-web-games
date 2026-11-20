// 生成海报：真实游戏画面 + 大标题贴纸字（HTML 叠字 → Playwright 截图）。
// 输出 poster.jpg (1280x720) 与 poster-1920.jpg (1920x1080)。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/homebrew/lib/node_modules/playwright/index.js');
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8183, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

const OVERLAY = `
<div id="poster-overlay" style="position:fixed;inset:0;z-index:999;pointer-events:none;display:flex;flex-direction:column;align-items:center;">
  <div style="margin-top:56px;text-align:center;">
    <div style="font-family:'Trebuchet MS',sans-serif;font-size:120px;font-weight:900;letter-spacing:0.06em;color:#fff6d8;-webkit-text-stroke:3px #a8171f;text-shadow:0 6px 0 #a8171f,0 14px 28px rgba(0,0,0,0.7);">BEAT&nbsp;BALL</div>
    <div style="margin-top:8px;font-family:'Trebuchet MS',sans-serif;font-size:30px;font-weight:700;color:#ffd84e;text-shadow:0 2px 0 #7a1216,0 4px 10px rgba(0,0,0,0.6);letter-spacing:0.12em;">DODGE THE STICKS · HIT THE BEAT</div>
  </div>
</div>`;

async function shoot(vp, out) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8183/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.debug.startSeeded(2, 5)); // 三轨最丰富
  await page.waitForTimeout(1500);
  await page.evaluate((ov) => { const d = document.createElement('div'); d.innerHTML = ov; document.body.appendChild(d.firstChild); }, OVERLAY);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(ROOT, out), quality: 90, type: 'jpeg' });
  await ctx.close();
  console.log('saved', out);
}

await shoot([1280, 720], 'poster.jpg');
await shoot([1920, 1080], 'poster-1920.jpg');

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
process.exit(0);
