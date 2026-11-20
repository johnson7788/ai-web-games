// ACE GUNNER · 上线物料生成：poster.jpg / poster-1920.jpg / icon.png / favicon.png
// 用真实游戏画面（window.__renderDemo 渲染玩法帧）做底，HTML 叠大标题 → Playwright 截图。
// 运行：node tools/make-media.mjs

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
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
await new Promise((r) => server.listen(8155, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8155/');
await page.waitForFunction(() => typeof window.__renderDemo === 'function', { timeout: 15000 });
// 渲染一张玩法帧（含敌人/射手/城门/准星）
await page.evaluate(() => window.__renderDemo('noon-desert'));
await page.waitForTimeout(200);
const baseBuf = await page.locator('#canvas').screenshot({ type: 'png' });
const baseB64 = baseBuf.toString('base64');

// ---------- 海报（HTML 叠字，响应式按 vw 缩放） ----------
const posterHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  html, body { width:100vw; height:100vh; overflow:hidden; background:#000; }
  .stage { position:relative; width:100vw; height:100vh; }
  .bg { position:absolute; inset:0; background-image:url('data:image/png;base64,${baseB64}'); background-size:100% 100%; }
  .shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,6,2,.15) 0%, rgba(10,6,2,.05) 42%, rgba(10,6,2,.72) 100%); }
  .title-wrap { position:absolute; left:6vw; bottom:7vh; z-index:2; }
  .kicker { color:#ffd84e; font:800 2.6vw/1 system-ui,sans-serif; letter-spacing:.5em; text-shadow:0 2px 6px rgba(0,0,0,.7); margin-bottom:1vh; }
  .title { color:#ffe9b4; font:900 9.5vw/0.95 system-ui,sans-serif; letter-spacing:.04em; text-shadow:0 4px 0 #7a4a2a, 0 10px 26px rgba(0,0,0,.7); }
  .sub { color:#fff3d6; font:600 2.4vw/1.3 system-ui,sans-serif; margin-top:1.6vh; max-width:60vw; text-shadow:0 2px 8px rgba(0,0,0,.8); }
</style></head><body><div class="stage">
  <div class="bg"></div><div class="shade"></div>
  <div class="title-wrap">
    <div class="kicker">FRONTIER ARCHERY DEFENSE</div>
    <div class="title">ACE GUNNER</div>
    <div class="sub">Hold the wall. Draw. Loose. Survive the siege.</div>
  </div>
</div></body></html>`;

await page.setContent(posterHtml, { waitUntil: 'load' });
await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await page.setViewportSize({ width: 1920, height: 1080 });
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });

// ---------- 图标（从玩法画面裁切城墙+射手区域） ----------
const iconSizes = { 'icon.png': 256, 'favicon.png': 64 };
for (const [name, size] of Object.entries(iconSizes)) {
  const buf = await page.evaluate(async ({ baseB64, size }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + baseB64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    // 裁切城墙+射手+城门区域（源图左上 (30,150) 宽高 300）
    g.drawImage(img, 30, 150, 300, 300, 0, 0, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }, { baseB64, size });
  writeFileSync(join(ROOT, name), Buffer.from(buf, 'base64'));
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('media written: poster.jpg, poster-1920.jpg, icon.png, favicon.png');
process.exit(0);
