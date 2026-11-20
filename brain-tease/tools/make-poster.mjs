// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题/tagline → playwright 截图。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'tests', 'artifacts');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
await mkdir(ART, { recursive: true });

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
await new Promise((r) => server.listen(8148, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 1) 玩法底图（第 19 关太空：发射按钮 + 火箭 + 保护罩，最有张力）
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => window.__ll.tutorial.skip());
await page.evaluate(() => window.__ll.startLevel(19));
await page.waitForTimeout(500);
await page.screenshot({ path: join(ART, 'poster-base.png') });
await ctx.close();

// 2) HTML 叠字
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; background:#071418; font-family:'PingFang SC','Segoe UI','Microsoft YaHei',sans-serif; }
img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(7,20,24,.18) 0%, rgba(7,20,24,.08) 42%, rgba(7,20,24,.86) 100%); }
.brand { position:absolute; left:0; right:0; top:150px; text-align:center; }
h1 { font-size:120px; font-weight:900; letter-spacing:.12em; color:#eaffff; margin:0; text-shadow:0 0 24px rgba(73,224,192,.95), 0 0 64px rgba(73,224,192,.5), 0 4px 0 #0a3a34; }
.tag { margin-top:22px; font-size:30px; letter-spacing:.08em; color:#ffd166; text-shadow:0 0 18px rgba(255,209,102,.8); }
.badge { position:absolute; left:0; right:0; bottom:52px; text-align:center; font-size:26px; letter-spacing:.14em; color:#d9f6ef; text-shadow:0 2px 8px rgba(0,0,0,.7); }
</style></head><body>
<img class="bg" src="/tests/artifacts/poster-base.png">
<div class="shade"></div>
<div class="brand"><h1>BRAIN TEASE</h1><div class="tag">24 trap puzzles. One evil doctor.</div></div>
<div class="badge">TAP · DRAG · FLIP — THINK WRONG TO WIN</div>
</body></html>`;
await writeFile(join(ART, 'poster.html'), html);

const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ppage = await pctx.newPage();
await ppage.goto('http://127.0.0.1:8148/tests/artifacts/poster.html', { waitUntil: 'load', timeout: 20000 });
await ppage.waitForTimeout(400);
await ppage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await pctx.close();

await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
