// 生成海报：真实玩法画面 + HTML 大标题贴纸字 → Playwright 截图。
// 用法：node tools/poster.mjs
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
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch();

async function shoot(width, height, out) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8167/');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(11, 12); // 龙巢宝山终局
    window.__ll.pause();
  });
  await page.waitForTimeout(500);
  // 隐藏 HUD/暂停，注入大标题贴纸
  await page.evaluate(() => {
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
    const pause = document.getElementById('screen-pause');
    if (pause) pause.style.display = 'none';
    const over = document.createElement('div');
    over.id = 'poster-overlay';
    over.innerHTML =
      `<div class="pv-badge">MATCH 3 · FILL THE BAG</div>` +
      `<div class="pv-title">TILE VAULT</div>` +
      `<div class="pv-sub">宝库夜盗 · Raid the vault</div>`;
    over.style.cssText = 'position:absolute;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:none;';
    const badge = over.querySelector('.pv-badge');
    badge.style.cssText = 'font:800 20px system-ui;letter-spacing:4px;color:#1a1208;background:#F6C453;padding:8px 22px;border-radius:999px;box-shadow:0 4px 0 #6b4a12;';
    const title = over.querySelector('.pv-title');
    title.style.cssText = 'font:900 118px system-ui;letter-spacing:10px;color:#F6C453;text-shadow:0 6px 0 #6b4a12,0 12px 40px rgba(0,0,0,.75);line-height:1;';
    const sub = over.querySelector('.pv-sub');
    sub.style.cssText = 'font:700 26px system-ui;color:#F6E3B4;text-shadow:0 2px 0 #3a2206,0 6px 18px rgba(0,0,0,.7);';
    document.getElementById('game-container').appendChild(over);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  await ctx.close();
}

await shoot(1280, 720, join(ROOT, 'poster.jpg'));
await shoot(1920, 1080, join(ROOT, 'poster-1920.jpg'));

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('posters saved');
process.exit(0);
