// tools/make-poster.mjs — 玩法截图 → HTML 叠大标题(发光描边)+tagline → poster.jpg（1280×720）
// 用法：node tools/make-poster.mjs [out.jpg]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8149, r));

const out = process.argv[2] || 'poster.jpg';
await mkdir(join(ROOT, 'tests/artifacts'), { recursive: true });
const basePath = join(ROOT, 'tests/artifacts/poster-base.png');
const htmlPath = join(ROOT, 'tests/artifacts/poster.html');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8149/');
await page.waitForTimeout(900);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(200);
await page.evaluate(() => { window.__ll.run.flock = 8; });
// 跳两下，让画面有「跃起 + 羊群 + 障碍 + 目标条」的最张力状态
await page.keyboard.press('Space');
await page.waitForTimeout(160);
await page.screenshot({ path: basePath });

// 叠大标题 + tagline
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; font-family:'Segoe UI','PingFang SC',system-ui,sans-serif; }
.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.gradient { position:absolute; inset:0; background:linear-gradient(180deg, rgba(12,23,18,0.0) 30%, rgba(12,23,18,0.82) 100%); }
.title { position:absolute; left:64px; bottom:96px; font-size:88px; font-weight:900; letter-spacing:0.08em;
  color:#fffaf0; text-shadow: 0 0 6px #2f6f4f, 0 0 24px #2f6f4f, 0 0 48px #f2a34c, 0 4px 10px rgba(0,0,0,0.6); }
.tagline { position:absolute; left:68px; bottom:52px; font-size:26px; color:#fdf6ea; letter-spacing:0.04em;
  text-shadow: 0 2px 8px rgba(0,0,0,0.7); }
</style></head><body>
<img class="bg" src="poster-base.png">
<div class="gradient"></div>
<div class="title">CORGI DASH</div>
<div class="tagline">Herd sheep · chain perfect jumps · unleash the surge</div>
</body></html>`;
await writeFile(htmlPath, html);
await page.goto('http://127.0.0.1:8149/tests/artifacts/poster.html');
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, out), type: 'jpeg', quality: 88 });

await browser.close().catch(() => {});
server.close();
console.log('saved', out);
process.exit(0);
