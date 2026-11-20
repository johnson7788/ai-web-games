// 生成 poster.jpg（1280×720）：截一张玩法图 → HTML 叠大标题（发光描边）+ tagline → 截图存 jpg
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

setTimeout(() => { console.error('poster timeout'); process.exit(1); }, 40000);

const { server, port } = await serve(ROOT, 8170);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  try { localStorage.setItem('saucer-strike:tutorial-done', 'true'); } catch { /* noop */ }
});
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);

// 打几下，制造张力画面（飞碟 + 弹道 + 可能命中）
const cx = 640;
const cy = 660;
for (let i = 0; i < 5; i += 1) {
  const t = await page.evaluate(() => {
    const r = window.__ll.run;
    const s = r && r.saucers.find((x) => x.active);
    if (s) return { x: s.x, y: s.y };
    return { x: 640, y: 280 };
  });
  const ang = Math.atan2(t.y - cy, t.x - cx);
  const power = 0.75;
  const ax = cx + Math.cos(ang) * power * 360;
  const ay = cy + Math.sin(ang) * power * 360;
  await page.mouse.move(cx, cy + 24);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(ax, ay, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}
await page.waitForTimeout(500);
const basePath = join(ROOT, 'tests/artifacts/poster-base.png');
mkdirSync(dirname(basePath), { recursive: true });
await page.screenshot({ path: basePath });
await browser.close();
server.close();

// 叠标题 + tagline → poster.jpg
const base64 = readFileSync(basePath).toString('base64');
const html = `<!DOCTYPE html><html><head><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1280px;height:720px;overflow:hidden;background:#000;}
  .bg{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;}
  .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,8,14,0.1) 0%,rgba(6,8,14,0.05) 45%,rgba(6,8,14,0.6) 100%);}
  .txt{position:absolute;left:0;right:0;bottom:86px;text-align:center;font-family:'PingFang SC','Segoe UI',system-ui,sans-serif;}
  .title{font-size:96px;font-weight:900;letter-spacing:0.12em;color:#fff4d8;
    text-shadow:0 0 6px #000,0 0 18px rgba(255,209,102,0.95),0 0 46px rgba(255,209,102,0.6),0 2px 0 rgba(255,93,115,0.85);}
  .tag{font-size:26px;letter-spacing:0.28em;color:#f4ead8;text-shadow:0 2px 10px rgba(0,0,0,0.9);margin-top:14px;}
</style></head><body>
  <img class="bg" src="data:image/png;base64,${base64}">
  <div class="shade"></div>
  <div class="txt"><div class="title">SAUCER STRIKE</div><div class="tag">DRAG TO AIM · RELEASE TO FIRE</div></div>
</body></html>`;

const b2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const p2 = await b2.newPage({ viewport: { width: 1280, height: 720 } });
await p2.setContent(html, { waitUntil: 'load' });
await p2.waitForTimeout(250);
await p2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await b2.close();
console.log('saved poster.jpg');
process.exit(0);
