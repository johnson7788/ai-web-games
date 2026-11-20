// PHANTOM RUN · 上线物料：poster.jpg / poster-1920.jpg / icon.png / favicon.png。
// 真实玩法画面 + HTML 叠字大标题 → Playwright 截图；icon/favicon 从标题画面幽灵裁切。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
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
await new Promise((r) => server.listen(8167, r));
mkdirSync(ROOT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

const OVERLAY = `
<div id="poster-overlay" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:30;">
  <div style="font-family:'PingFang SC','Segoe UI',sans-serif;font-weight:900;font-size:8.5vw;letter-spacing:0.08em;line-height:1;color:transparent;background:linear-gradient(180deg,#E8F4FF 0%,#B9D4FF 45%,#7EE0F0 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-stroke:0.28vw #3D2A6B;paint-order:stroke fill;filter:drop-shadow(0 0.6vw 0 rgba(0,0,0,0.4));">PHANTOM RUN</div>
  <div style="margin-top:1.6vh;font-family:'PingFang SC','Segoe UI',sans-serif;font-weight:800;font-size:2.2vw;color:#FFE08A;text-shadow:0 0.3vw 0.5vw rgba(0,0,0,0.7);letter-spacing:0.06em;">Escape the magic tower as a ghost</div>
</div>`;

async function inject(page) {
  await page.evaluate((html) => {
    document.querySelector('#poster-overlay')?.remove();
    const c = document.getElementById('game-container');
    c.insertAdjacentHTML('beforeend', html);
  }, OVERLAY);
}

// poster 1280x720（玩法画面：幽影在魔塔屋顶）
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8167/');
await page.waitForTimeout(600);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  window.__ll.debug.hold(true);
  const r = window.__ll.run();
  r.state.player.x = 500;
  r.state.player.y = 554;
});
await page.waitForTimeout(150);
await inject(page);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
console.log('poster.jpg');

// poster-1920 1920x1080
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page2 = await ctx2.newPage();
await page2.goto('http://127.0.0.1:8167/');
await page2.waitForTimeout(600);
await page2.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  window.__ll.debug.hold(true);
  const r = window.__ll.run();
  r.state.player.x = 500;
  r.state.player.y = 554;
});
await page2.waitForTimeout(150);
await inject(page2);
await page2.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });
console.log('poster-1920.jpg');
await ctx2.close();
await ctx.close();

// icon / favicon：从标题画面裁切幽灵
const cctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const cpage = await cctx.newPage();
await cpage.goto('http://127.0.0.1:8167/');
await cpage.waitForTimeout(600);
// 标题画面幽灵位于 (640, 520)，裁 256x256
await cpage.screenshot({ path: join(ROOT, 'icon.png'), clip: { x: 512, y: 392, width: 256, height: 256 } });
await cpage.screenshot({ path: join(ROOT, 'favicon.png'), clip: { x: 512, y: 392, width: 256, height: 256 } });
console.log('icon.png / favicon.png');
await cctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done');
process.exit(0);
