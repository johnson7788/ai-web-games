// 生成 icon.png(256) + favicon.png(64)：从真实游戏画面裁切一个宝藏块。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8177, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8177/');
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 1);
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'none';
});
await page.waitForTimeout(400);
const rect = await page.evaluate(() => {
  const lay = window.__ll.debug.layout();
  return lay && lay.firstFree ? lay.firstFree : null;
});
const side = 120;
const clip = rect
  ? { x: Math.max(0, rect.x + rect.w / 2 - side / 2), y: Math.max(0, rect.y + rect.h / 2 - side / 2), width: side, height: side }
  : { x: 400, y: 200, width: 480, height: 480 };
const raw = join(ROOT, 'tests', 'artifacts', 'icon-raw.png');
await page.screenshot({ path: raw, clip });
await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();

execFileSync('sips', ['-z', '256', '256', raw, '--out', join(ROOT, 'icon.png')], { stdio: 'ignore' });
execFileSync('sips', ['-z', '64', '64', raw, '--out', join(ROOT, 'favicon.png')], { stdio: 'ignore' });
console.log('icon + favicon saved');
process.exit(0);
