// 生成 icon.png（256×256）与 favicon.png（32×32）：从游戏花窗图案裁切。
// 用法：node tools/icon.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8150, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8150/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__drawIcon === 'function', { timeout: 15000 });
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  const hud = document.getElementById('hud');
  if (hud) hud.classList.add('hidden');
  window.__drawIcon();
});
await page.waitForTimeout(250);
const full = join(ROOT, 'tests', 'artifacts', 'icon-full.png');
await page.screenshot({ path: full });
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 裁切中心 700×700 → 256 / 32
execFileSync('ffmpeg', ['-y', '-i', full, '-vf', 'crop=700:700:290:10,scale=256:256', join(ROOT, 'icon.png')], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-i', full, '-vf', 'crop=700:700:290:10,scale=32:32', join(ROOT, 'favicon.png')], { stdio: 'inherit' });
console.log('saved icon.png + favicon.png');
process.exit(0);
