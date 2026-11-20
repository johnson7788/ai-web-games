// 生成 poster.jpg（1280×720）：真实玩法图（贪心 AI 驱动到中期棋盘）→ DOM 叠大标题（发光描边）+ tagline → 截图存 jpg。
// 用法：node tools/make-poster.mjs
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
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8153, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8153/');
await page.waitForTimeout(700);
// 从第 2 关开始（有引力井 + 更丰富的棋盘），跳过引导后用贪心 AI 打出一个有张力的中期棋盘
await page.evaluate(() => { window.__ll.startAct(2); });
await page.waitForTimeout(350);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
for (let i = 0; i < 14; i += 1) {
  await page.evaluate(() => window.__ll.debug.greedyMove());
  await page.waitForTimeout(120);
}
await page.waitForTimeout(250);

// 叠海报层：大标题（发光描边）+ tagline + 关键卖点
await page.evaluate(() => {
  const wrap = document.createElement('div');
  wrap.id = 'poster-overlay';
  wrap.innerHTML = `
    <style>
      #poster-overlay{position:absolute;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:44px 60px 60px;background:linear-gradient(180deg,rgba(2,7,15,0.28) 0%,rgba(2,7,15,0.10) 42%,rgba(2,7,15,0.86) 100%);}
      .p-title{font-family:'Segoe UI','PingFang SC',sans-serif;font-size:88px;font-weight:800;letter-spacing:0.16em;color:#eaffff;text-shadow:0 0 22px rgba(84,231,255,0.95),0 0 54px rgba(84,231,255,0.5),0 0 3px #06101c;line-height:1;}
      .p-tag{font-family:'Segoe UI','PingFang SC',sans-serif;font-size:24px;letter-spacing:0.06em;color:#cfe9ff;margin-top:16px;text-shadow:0 1px 8px rgba(2,7,15,0.9);}
      .p-sub{font-family:'Segoe UI','PingFang SC',sans-serif;font-size:16px;letter-spacing:0.14em;color:#8fb6c6;margin-top:12px;text-shadow:0 1px 6px rgba(2,7,15,0.9);}
    </style>
    <div class="p-title">MERGE 2048</div>
    <div class="p-tag">Slide the fleet. Merge tonnage. Build a star colony to 2048.</div>
    <div class="p-sub">12 SECTORS · GRAVITY WELLS · WARP ENGINE</div>`;
  document.getElementById('game-container').appendChild(wrap);
});
await page.waitForTimeout(150);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
