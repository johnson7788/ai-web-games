// INK PATH · 上线海报生成：真实玩法画面（点亮丝线的大师网）+ HTML 贴纸字叠层，
// 用 Playwright 截图出 poster.jpg(1280×720) 与 poster-1920.jpg(1920×1080)。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8178, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8178/');
await page.waitForTimeout(900);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

// 背板：加载大师网并点亮一段丝线（不织完，避免结算屏）
await page.evaluate(() => {
  window.__ll.debug.startSeeded(11, 7);
  const sol = window.__ll.run()._solution || [];
  const keep = Math.min(5, sol.length - 1);
  for (let i = 1; i <= keep; i += 1) window.__ll.run().tryMove(sol[i]);
});
await page.waitForTimeout(400);

// 注入海报贴纸字叠层（vw 单位，随视口等比放大）
await page.addStyleTag({ content: `
  #poster-overlay{position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center;
    background:linear-gradient(180deg,rgba(6,8,16,0.12),rgba(6,8,16,0.50) 68%,rgba(6,8,16,0.80));}
  #poster-title{font-family:'PingFang SC','Segoe UI',sans-serif;font-weight:900;letter-spacing:0.08em;line-height:1.02;font-size:12vw;
    background:linear-gradient(180deg,#FFF6C9,#FFD95C 45%,#FF9D2E);-webkit-background-clip:text;background-clip:text;color:transparent;
    -webkit-text-stroke:3px #14204a;paint-order:stroke fill;filter:drop-shadow(0 6px 0 rgba(0,0,0,0.35));}
  #poster-sub{margin-top:1.4vh;font-size:3.1vw;font-weight:700;color:rgba(235,245,255,0.95);text-shadow:0 2px 6px rgba(0,0,0,0.55);}
  #poster-tag{margin-top:2.2vh;font-size:1.7vw;font-weight:800;letter-spacing:0.28em;color:#ffd65a;text-shadow:0 2px 5px rgba(0,0,0,0.5);}
` });
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.innerHTML = '<div id="poster-title">INK PATH</div><div id="poster-sub">Weave the star web · One unbroken thread</div><div id="poster-tag">PUZZLE</div>';
  document.body.appendChild(ov);
});

await page.screenshot({ path: join(ROOT, 'poster.jpg') });
console.log('saved poster.jpg (1280×720)');

// 1920×1080：容器铺满视口，贴纸字随 vw 放大
await page.setViewportSize({ width: 1920, height: 1080 });
await page.addStyleTag({ content: '#game-container{width:100vw !important;height:100vh !important;max-width:none !important;max-height:none !important;aspect-ratio:auto !important;}' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster-1920.jpg') });
console.log('saved poster-1920.jpg (1920×1080)');

await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
