// tools/make-poster.mjs — 截玩法图 → 叠发光大标题 + tagline → poster.jpg（1280×720）
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8152, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// 1) 玩法截图（真实运行）
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8152/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch {} window.__ll.start(); });
await page.waitForTimeout(700);
await page.mouse.move(640, 360);
await page.waitForTimeout(900);
const shotBuf = await page.screenshot({ type: 'png' });
await page.close();
mkdirSync(join(ROOT, 'tests', 'artifacts'), { recursive: true });
const shotPath = join(ROOT, 'tests', 'artifacts', 'poster-shot.png');
writeFileSync(shotPath, shotBuf);

// 2) 叠标题
const shotB64 = shotBuf.toString('base64');
const posterPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await posterPage.setContent(`<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#04222e; font-family:'Segoe UI','PingFang SC',sans-serif; }
  .bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(4,18,28,0.25) 0%, rgba(4,18,28,0) 40%, rgba(4,18,28,0.55) 100%); }
  .title { position:absolute; left:0; right:0; top:44px; text-align:center; font-weight:900; font-size:108px; letter-spacing:0.12em; color:#eaffff;
    text-shadow: 0 0 6px #04222e, 0 0 24px #2ee6c8, 0 0 54px #2ee6c8, 0 4px 0 #0b3a4a; }
  .tag { position:absolute; left:0; right:0; top:190px; text-align:center; font-size:28px; letter-spacing:0.06em; color:#d9f4ff;
    text-shadow: 0 0 12px rgba(46,230,200,0.9), 0 2px 0 #04222e; }
  .sub { position:absolute; left:0; right:0; bottom:26px; text-align:center; font-size:18px; color:#8fb6c6; letter-spacing:0.2em; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${shotB64}" />
  <div class="shade"></div>
  <div class="title">OCEAN DASH</div>
  <div class="tag">Lead the school · ride the current · race to the finish</div>
  <div class="sub">GATHER &nbsp;·&nbsp; GLIDE &nbsp;·&nbsp; OUTPACE</div>
</body></html>`);
await posterPage.waitForTimeout(300);
await posterPage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await posterPage.close();

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg');
process.exit(0);
