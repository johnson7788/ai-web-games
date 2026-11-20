// 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题（发光描边）+ tagline → 截图。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8153, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8153/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => window.__ll.debug.startLevel(1));
await page.waitForTimeout(300);
// 插两刀，让玩法目标（桩 + 手里剑）可见
await page.evaluate(() => { window.__ll.debug.stickOne(); window.__ll.debug.stickOne(); });
await page.waitForTimeout(500);
const bgPath = join(ROOT, 'tests/artifacts/poster-bg.png');
await page.screenshot({ path: bgPath });
await page.close();

// 叠加标题的 HTML
const posterHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden}
body{background:url('./poster-bg.png') center/cover no-repeat #04180f;font-family:'PingFang SC','Segoe UI',sans-serif}
.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,24,15,.25) 0%,rgba(4,24,15,.05) 45%,rgba(4,24,15,.75) 100%)}
.logo{position:absolute;left:64px;top:44px;font-size:104px;font-weight:900;letter-spacing:.08em;color:#eafff4;text-shadow:0 0 18px rgba(126,240,176,.9),0 0 46px rgba(126,240,176,.5),0 2px 0 #0a2c1c}
.tag{position:absolute;left:68px;top:196px;max-width:640px;font-size:26px;color:#d8f2e4;text-shadow:0 1px 8px rgba(4,24,15,.9)}
.cta{position:absolute;left:68px;top:620px;font-size:22px;letter-spacing:.14em;color:#ffd98a;text-shadow:0 0 12px rgba(255,217,138,.7)}
</style></head><body>
<div class="veil"></div>
<div class="logo">KNIFE LORE</div>
<div class="tag">Throw shuriken into the spinning scroll post. Never nick your own blades.</div>
<div class="cta">CLICK · THROW · CLEAVE</div>
</body></html>`;
await writeFile(join(ROOT, 'tests/artifacts/poster.html'), posterHtml);

const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p2.goto('http://127.0.0.1:8153/tests/artifacts/poster.html');
await p2.waitForTimeout(400);
await p2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('poster.jpg saved');
process.exit(0);
