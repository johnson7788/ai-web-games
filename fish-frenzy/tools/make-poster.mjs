// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：真实玩法截图 + 发光描边大标题 + tagline
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
await new Promise((r) => server.listen(8170, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8170/');
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);

// 进入玩法并跳到 Boss 场（更有张力），等鱼群出现
await page.evaluate(() => window.__ll.debug.startStage(4));
await page.waitForTimeout(1800);
// 注入 Boss，确保画面有高价值目标
await page.evaluate(() => {
  const r = window.__ll.run;
  if (r) r.fish.push({ id: 9999, species: 10, hp: 25, value: 300, radius: 52, speed: 22, boss: true, x: 760, y: 240, pathId: 2, path: null, seg: 0, travel: 0, phase: 0, sway: 0, delay: 0, alive: true });
});
await page.waitForTimeout(500);

// 叠加发光描边大标题 + tagline
await page.evaluate(() => {
  const d = document.createElement('div');
  d.id = 'poster-overlay';
  d.innerHTML =
    '<div class="p-title">FISH FRENZY</div>' +
    '<div class="p-tag">Aim · Net · Chase the forecast</div>';
  d.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;pointer-events:none;z-index:50;background:linear-gradient(180deg,rgba(2,10,18,0.0) 40%,rgba(2,10,18,0.55) 100%);';
  document.getElementById('game-container').appendChild(d);
  const title = d.querySelector('.p-title');
  title.style.cssText = 'font-size:96px;font-weight:900;letter-spacing:0.16em;color:#eaffff;font-family:"SF Mono","Menlo",monospace;text-shadow:0 0 10px #54e7ff,0 0 26px #54e7ff,0 0 60px #2aa9c4,0 4px 0 #06202e;';
  const tag = d.querySelector('.p-tag');
  tag.style.cssText = 'font-size:26px;letter-spacing:0.24em;color:#ffd166;font-family:"SF Mono","Menlo",monospace;text-shadow:0 0 12px rgba(255,201,74,0.9);text-transform:uppercase;';
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
