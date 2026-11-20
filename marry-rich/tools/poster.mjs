// tools/poster.mjs — MARRY RICH · 生成 poster.jpg（1280×720）：真实玩法图 + HTML 叠大标题。
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
await new Promise((r) => server.listen(8151, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8151/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title');
await page.evaluate(() => localStorage.clear());
// 跳到第 5 章限时抉择：人生天平 + 倒计时 + 三选项（最有张力的画面）
await page.evaluate(() => window.__ll.debug.startSeeded([0, 0, 0, 0]));
await page.waitForTimeout(1600);

// 叠大标题 + tagline
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;z-index:50;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:70px;';
  ov.innerHTML =
    '<div style="font-size:96px;font-weight:800;letter-spacing:0.14em;color:#fff7e6;text-shadow:0 0 26px #ffd76a,0 0 60px #c084fc;">MARRY RICH</div>' +
    '<div style="margin-top:14px;font-size:26px;color:#ffd76a;letter-spacing:0.08em;text-shadow:0 2px 10px rgba(0,0,0,0.8);">十二个人生节点 · 八种命运 · 你的逆袭之路</div>';
  document.getElementById('game-container').appendChild(ov);
});
await page.waitForTimeout(250);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
