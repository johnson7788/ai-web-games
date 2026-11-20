// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题（发光描边）+ tagline。
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPoster = path.join(root, 'poster.jpg');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'brick-six-poster-'));

const { server, port } = await serve(root, 8189);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const baseUrl = `http://127.0.0.1:${port}/`;

// 1) 抓一张最戏剧性的玩法图：金瀑三环 + 全盘蜂巢，隐藏 DOM HUD
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(400);
const skip = page.locator('[data-tutorial-skip]').first();
if (await skip.count()) await skip.click({ force: true });
await page.waitForTimeout(300);
await page.evaluate(() => {
  const r = window.__ll.run;
  const color = (q, rr) => (((q + rr) % 6) + 6) % 6;
  r.cells.forEach((c) => {
    if (!c.wall) { c.filled = true; c.color = color(c.q, c.r); }
  });
  window.G.renderer.burst(640, 400, 'cascade');
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'none';
});
await page.waitForTimeout(150);
const heroPng = path.join(tmp, 'hero.png');
await page.screenshot({ path: heroPng });
await ctx.close();
server.closeAllConnections?.();
server.close();

// 2) HTML 叠字
const b64 = readFileSync(heroPng).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; }
body { width:1280px; height:720px; overflow:hidden; font-family:'PingFang SC','Hiragino Sans','Segoe UI',sans-serif; }
.bg { position:absolute; inset:0; background:url(data:image/png;base64,${b64}) center/cover no-repeat; }
.glow { position:absolute; left:0; right:0; top:88px; text-align:center; font-size:118px; font-weight:900; letter-spacing:0.12em; color:#fff8e0; text-shadow:0 0 18px #ffd45e, 0 0 46px rgba(255,212,94,.85), 0 4px 0 #8a5a16, 0 8px 26px rgba(0,0,0,.6); }
.tag { position:absolute; left:0; right:0; top:330px; text-align:center; font-size:30px; letter-spacing:0.16em; color:#ffe9a8; text-shadow:0 2px 10px rgba(0,0,0,.8), 0 0 20px rgba(255,212,94,.5); }
.sub { position:absolute; left:0; right:0; bottom:70px; text-align:center; font-size:22px; letter-spacing:0.22em; color:#f4f7e8; text-shadow:0 2px 8px rgba(0,0,0,.8); }
</style></head><body>
<div class="bg"></div>
<div class="glow">BRICK SIX</div>
<div class="tag">Fill the rings. Trigger the golden cascade.</div>
<div class="sub">HONEYCOMB WORKSHOP</div>
</body></html>`;
const htmlPath = path.join(tmp, 'poster.html');
writeFileSync(htmlPath, html);

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.goto('file://' + htmlPath, { waitUntil: 'load' });
await page2.waitForTimeout(200);
await page2.screenshot({ path: outPoster, type: 'jpeg', quality: 88 });
await ctx2.close();
await browser.close();
rmSync(tmp, { recursive: true, force: true });

const { statSync } = await import('node:fs');
console.log('saved', outPoster, `${Math.round(statSync(outPoster).size / 1024)}KB`);
