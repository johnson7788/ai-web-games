// INK PATH · 图标源图生成：点亮丝线的大师网（无文字叠层），供 ffmpeg 裁切缩放。
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
await new Promise((r) => server.listen(8179, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8179/');
await page.waitForTimeout(900);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => {
  window.__ll.debug.startSeeded(11, 7);
  const sol = window.__ll.run()._solution || [];
  const keep = Math.min(5, sol.length - 1);
  for (let i = 1; i <= keep; i += 1) window.__ll.run().tryMove(sol[i]);
});
await page.waitForTimeout(400);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', '_icon-src.png') });
console.log('saved icon source');
await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
