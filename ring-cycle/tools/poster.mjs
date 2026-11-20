// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题/tagline。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile, copyFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'tests', 'artifacts', 'poster');
mkdirSync(ART, { recursive: true });

// 用真实玩法截图做底（球 + 彩环 + HUD）
await copyFile(join(ROOT, 'tests', 'final', '02-play.png'), join(ART, 'base.png'));

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; font-family:'PingFang SC','Segoe UI',system-ui,sans-serif; }
  .wrap { position:relative; width:1280px; height:720px; }
  img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .scrim { position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,4,10,0.15) 0%, rgba(20,4,10,0.05) 38%, rgba(20,4,10,0.72) 100%); }
  .title { position:absolute; left:56px; bottom:74px; font-size:96px; font-weight:900; letter-spacing:0.10em; color:#fff2f6;
    text-shadow: 0 0 6px #fff, 0 0 20px #ff5d8f, 0 0 44px #ff9db8, 0 2px 0 rgba(20,4,10,0.9); }
  .tagline { position:absolute; left:60px; bottom:38px; font-size:30px; font-weight:600; letter-spacing:0.04em; color:#ffe8ef;
    text-shadow: 0 0 10px rgba(255,157,184,0.9), 0 2px 0 rgba(20,4,10,0.85); }
</style></head><body>
  <div class="wrap">
    <img class="bg" src="base.png">
    <div class="scrim"></div>
    <div class="title">RING CYCLE</div>
    <div class="tagline">Steer · Match · Rainbow</div>
  </div>
</body></html>`;
await writeFile(join(ART, 'poster.html'), html);

const MIME = { '.html': 'text/html', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ART, normalize(url === '/' ? 'poster.html' : url));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8199, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8199/poster.html');
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
server.close();
console.log('saved poster.jpg');
process.exit(0);
