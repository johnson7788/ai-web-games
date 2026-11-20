// 上线物料生成：poster.jpg / poster-1920.jpg / icon.png / favicon.png
// 用真实玩法画面 + HTML 叠大标题 → Playwright 截图（参考 oasis 的做法）。
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

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
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// 1) 真实玩法底图（L9 藏宝地窖，全牌桌）
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:8167/');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(8, 7);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(ROOT, 'tests/artifacts/poster-base.png') });
  await page.close();
}

const base = await readFile(join(ROOT, 'tests/artifacts/poster-base.png'));
const baseData = `data:image/png;base64,${base.toString('base64')}`;

// 2) 海报：底图 + 大标题贴纸字
const posterHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; overflow:hidden; }
  .wrap { position:relative; width:100%; height:100%; }
  .bg { position:absolute; inset:0; background:url('${baseData}') center/cover no-repeat; filter:brightness(0.82) saturate(1.05); }
  .veil { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 32%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(10,6,2,0.78) 100%); }
  .title { position:absolute; top:6%; left:0; right:0; text-align:center; font-family:Georgia,'Times New Roman',serif; }
  .title h1 { font-size:11vw; letter-spacing:0.06em; color:#f7dc7a; text-shadow:0 3px 0 #6b3f0a, 0 8px 34px rgba(0,0,0,0.7); margin:0; }
  .title .sub { font-size:2.6vw; color:#f3e9d2; letter-spacing:0.14em; text-shadow:0 2px 10px rgba(0,0,0,0.8); margin-top:0.4vw; }
  .badge { position:absolute; bottom:8%; left:50%; transform:translateX(-50%); background:rgba(20,12,4,0.85); border:2px solid #f7dc7a; color:#f7dc7a; padding:0.8vw 2.4vw; border-radius:999px; font-family:'Segoe UI',sans-serif; font-size:1.9vw; letter-spacing:0.08em; }
</style></head><body><div class="wrap">
  <div class="bg"></div><div class="veil"></div>
  <div class="title"><h1>CARD ROYALE</h1><div class="sub">A ROYAL TRIPEAKS SOLITAIRE</div></div>
  <div class="badge">FREE TO PLAY · DESKTOP &amp; MOBILE</div>
</div></body></html>`;

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(posterHtml, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });
  await page.close();
}

// 3) 图标：程序化画一张「王冠卡背」，icon 256 + favicon 64
const iconHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}</style></head><body>
<canvas id="c" width="256" height="256"></canvas>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
const g=x.createLinearGradient(0,0,256,256);g.addColorStop(0,'#2a1a12');g.addColorStop(1,'#0c0703');
x.fillStyle=g;x.fillRect(0,0,256,256);
x.strokeStyle='#f7dc7a';x.lineWidth=8;x.strokeRect(16,16,224,224);
x.strokeStyle='rgba(247,220,122,0.5)';x.lineWidth=3;x.strokeRect(28,28,200,200);
// 皇冠
x.fillStyle='#f7dc7a';
x.beginPath();
x.moveTo(58,160);x.lineTo(58,104);x.lineTo(92,138);x.lineTo(128,96);x.lineTo(164,138);x.lineTo(198,104);x.lineTo(198,160);x.closePath();x.fill();
x.fillRect(58,160,140,20);
// 宝石
x.fillStyle='#c0392b';x.beginPath();x.arc(128,150,13,0,Math.PI*2);x.fill();
x.fillStyle='#2a1a12';x.font='bold 64px Georgia,serif';x.textAlign='center';x.textBaseline='middle';x.fillText('K',128,118);
</script></body></html>`;
{
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });
  await page.setContent(iconHtml, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(ROOT, 'icon.png') });
  // favicon：从 icon 缩小
  const buf = await page.locator('#c').screenshot({ type: 'png' });
  // 直接用 64px 视口重截一张 favicon
  await page.setViewportSize({ width: 64, height: 64 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(ROOT, 'favicon.png') });
  await page.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('materials done: poster.jpg / poster-1920.jpg / icon.png / favicon.png');
process.exit(0);
