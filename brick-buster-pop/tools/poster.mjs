// 生成海报：真实玩法画面（战斗屏，球在飞行）→ Playwright 截图 1280×720。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8210, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ll, { timeout: 10000 });
await page.waitForTimeout(600);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.start(3); // L4：交叉火力，有岩石 + 竖激光 + 多排砖
  const run = window.__ll.run();
  if (run) { run.aim(28); run.fire(); }
});
await page.waitForTimeout(1300);
// 大标题贴纸
await page.evaluate(() => {
  const over = document.createElement('div');
  over.style.cssText = 'position:absolute;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;pointer-events:none;padding-top:24px;';
  const badge = document.createElement('div');
  badge.textContent = 'NEON ARCADE · BRICK BREAKER';
  badge.style.cssText = 'font:800 18px system-ui;letter-spacing:4px;color:#05060f;background:#7dd3fc;padding:7px 20px;border-radius:999px;';
  const title = document.createElement('div');
  title.textContent = 'BRICK BUSTER POP';
  title.style.cssText = 'font:900 76px system-ui;letter-spacing:8px;color:#7dd3fc;text-shadow:0 4px 0 #1e3a8a,0 10px 34px rgba(0,0,0,.8);line-height:1.15;margin-top:14px;';
  over.appendChild(badge);
  over.appendChild(title);
  document.getElementById('game-container').appendChild(over);
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg') });
await browser.close();
server.close();
console.log('✓ poster.jpg generated');
