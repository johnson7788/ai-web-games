// tools/poster.mjs — 截一张最有张力的玩法图 → HTML 叠大标题 + tagline → 截图存 poster.jpg
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const art = join(ROOT, 'tools', 'artifacts');
mkdirSync(art, { recursive: true });
const base = join(art, 'poster-base.png');

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8161);

// 1) 玩法图：快进到跳台腾空（签名瞬间）
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(200);
await page.evaluate(() => { const el = document.querySelector('[data-tutorial-skip]'); if (el) el.click(); });
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let i = 0; i < 40000 && r.phase === 'playing'; i++) {
    const s = Math.max(-1, Math.min(1, -r.playerX * 5));
    r.step({ steer: s, throttle: 1, brake: 0, tune: false });
    r.drainEvents();
    if (r.stage >= 4 && r.airborne) break;
  }
});
await page.waitForTimeout(80);
await page.screenshot({ path: base });
await ctx.close();
server.close();

// 2) HTML 叠字 → jpg
const b64 = readFileSync(base).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; }
html,body { width:1280px; height:720px; overflow:hidden; font-family:'PingFang SC','Hiragino Sans','Segoe UI','Microsoft YaHei',monospace; }
.bg { position:absolute; inset:0; background:url(data:image/png;base64,${b64}) center/cover no-repeat; }
.shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(30,14,2,0.06) 0%, rgba(30,14,2,0) 34%, rgba(20,10,2,0.72) 100%); }
.title { position:absolute; left:0; right:0; top:88px; text-align:center; font-size:116px; font-weight:800; letter-spacing:0.18em; color:#fff7e2;
  text-shadow: 0 0 22px rgba(255,190,60,0.95), 0 0 52px rgba(255,120,40,0.8), 0 4px 0 rgba(120,50,10,0.55); }
.tagline { position:absolute; left:0; right:0; top:238px; text-align:center; font-size:34px; letter-spacing:0.08em; color:#ffe9bd; text-shadow:0 2px 12px rgba(0,0,0,0.6); }
.sub { position:absolute; left:0; right:0; top:296px; text-align:center; font-size:20px; letter-spacing:0.32em; color:#ffd488; text-shadow:0 2px 10px rgba(0,0,0,0.7); }
</style></head><body>
<div class="bg"></div><div class="shade"></div>
<div class="title">DUNE BUGGY</div>
<div class="tagline">Ride the golden ridge · Beat the clock</div>
<div class="sub">12 DESERT STAGES · BAJA RALLY</div>
</body></html>`;
writeFileSync(join(art, 'poster.html'), html);

const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ppage = await pctx.newPage();
await ppage.setContent(html, { waitUntil: 'load' });
await ppage.waitForTimeout(200);
await ppage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await pctx.close();
await browser.close();

const { statSync } = await import('node:fs');
console.log('saved', join(ROOT, 'poster.jpg'), `${Math.round(statSync(join(ROOT, 'poster.jpg')).size / 1024)}KB`);
process.exit(0);
