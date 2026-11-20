// 生成 poster.jpg：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile, writeFileSync, mkdirSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
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
    const data = await readFileP(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8149, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8149/');
await page.waitForTimeout(900);
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForTimeout(400);

// 制造张力画面：移动 + 射击（子弹 + 击杀 + 安全区可见）
await page.keyboard.down('KeyD');
await page.mouse.move(1000, 320);
await page.mouse.down();
await page.waitForTimeout(1800);
await page.mouse.up();
await page.keyboard.up('KeyD');
await page.waitForTimeout(300);

const bg = await page.screenshot({ type: 'png' });
await browser.close();
server.closeAllConnections?.();
server.close();

// 叠字：发光描边大标题 + tagline
const bgB64 = bg.toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1280px; height:720px; overflow:hidden; }
body { background:#0a0603; font-family:'Segoe UI','PingFang SC',monospace; }
.stage { position:relative; width:1280px; height:720px; }
.stage img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,6,3,0.25) 0%, rgba(10,6,3,0) 40%, rgba(10,6,3,0.75) 100%); }
.title-wrap { position:absolute; left:0; right:0; top:52px; text-align:center; z-index:2; }
.title { font-size:88px; font-weight:900; letter-spacing:0.08em; color:#fff3d0;
  text-shadow: 0 0 6px #ffd94d, 0 0 22px #ff9d3d, 0 0 46px #ff6a00, 0 4px 0 #5a2d00; }
.tagline { margin-top:14px; font-size:26px; letter-spacing:0.06em; color:#ffe9b8; text-shadow:0 0 10px rgba(255,160,40,0.9), 0 2px 0 #3a1c00; }
</style></head><body>
<div class="stage">
  <img class="bg" src="data:image/png;base64,${bgB64}">
  <div class="veil"></div>
  <div class="title-wrap">
    <div class="title">BATTLE ROYALE MINI</div>
    <div class="tagline">Toy soldiers. Loot. Shrink. Survive.</div>
  </div>
</div>
</body></html>`;

mkdirSync(join(ROOT, 'tests/artifacts'), { recursive: true });
const posterHtml = join(ROOT, 'tests/artifacts/poster.html');
writeFileSync(posterHtml, html);

const b2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const p2 = await b2.newPage({ viewport: { width: 1280, height: 720 } });
await p2.goto('file://' + posterHtml);
await p2.waitForTimeout(400);
await p2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await b2.close();
console.log('saved poster.jpg');
process.exit(0);
