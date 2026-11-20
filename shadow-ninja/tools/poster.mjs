// Shadow Ninja Cat · 生成 poster.jpg（1280×720，真实标题屏 + 大标题贴纸字）。
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
await new Promise((r) => server.listen(8161, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8161/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(900);

await page.addStyleTag({ content: `
  #level-grid, .total-stars, #btn-start, .title-btns, .lang-select, .subtitle { display: none !important; }
  #screen-title { background: linear-gradient(180deg, rgba(8,5,14,0.0) 0%, rgba(8,5,14,0.55) 100%); justify-content: flex-end; padding-bottom: 90px; }
  #title-text { font-size: 96px; letter-spacing: 6px; text-shadow: 0 6px 0 rgba(0,0,0,0.7), 0 0 40px rgba(255,216,78,0.55); margin-bottom: 18px; }
  #screen-title::after { content: "DASH · JUMP · DIVE"; display: block; font-size: 24px; letter-spacing: 10px; color: #efe6ff; opacity: 0.9; margin-bottom: 4px; }
` });

await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
console.log('poster.jpg done');
await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
