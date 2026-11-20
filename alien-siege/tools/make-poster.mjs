// tools/make-poster.mjs — 生成 poster.jpg（1280×720）
// 截一张最有张力的玩法图 → HTML 叠大标题（发光描边）+ tagline → playwright 截图存 jpg。
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8148, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('alien-siege:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(300);

// 摆一张张力画面：霰弹枪 + 巨兽近距紫浆 + 标记 + 护盾
await page.evaluate(() => {
  const r = window.__ll.run;
  const p = r.player;
  r.enemies = [];
  r.wave = 6;
  r.waveState = 'active';
  p.x = 12.5; p.y = 12.5; p.angle = -0.12;
  p.weapon = 'shotgun';
  p.ammo = 6; p.reloading = false; p.fireCooldown = 0;
  p.shieldActive = true; p.shieldEnergy = 80;
  const mk = (id, type, x, y, hp, radius, marked) => ({ id, type, x, y, hp, maxHp: hp, speed: 1.0, radius, damage: 8, attackRange: 0.9, attackCooldown: 1, drift: type === 'floater' ? 1.7 : 0, score: 100, attackCd: 0, driftPhase: 0, spawnCd: 0, marked, markedUntil: Infinity });
  r.enemies.push(mk(8001, 'crawler', p.x + 2.8, p.y - 0.9, 18, 0.26, false));
  r.enemies.push(mk(8002, 'behemoth', p.x + 3.9, p.y + 0.3, 95, 0.52, true));
  r.enemies.push(mk(8003, 'floater', p.x + 5.6, p.y + 1.4, 30, 0.34, false));
});
await page.waitForTimeout(200);
// 触发一次近距霰弹 → 紫浆
await page.keyboard.down('Space');
await page.waitForTimeout(220);
await page.keyboard.up('Space');
await page.waitForTimeout(250);

const shot = join(ROOT, 'tests', 'artifacts', 'poster-shot.png');
await page.screenshot({ path: shot });

// 叠标题 HTML
const overlay = await ctx.newPage();
await overlay.setContent(`<!DOCTYPE html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#000; }
  .bg { position:absolute; inset:0; width:1280px; height:720px; }
  .veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(13,7,18,0.55) 0%, rgba(13,7,18,0.15) 42%, rgba(13,7,18,0.72) 100%); }
  .title-wrap { position:absolute; left:64px; top:66px; }
  .logo {
    font-family: 'Arial Black', 'PingFang SC', sans-serif; font-weight:900; font-size:104px; letter-spacing:0.06em;
    color:#f4eaff; line-height:1; text-shadow: 0 0 6px #b47aff, 0 0 22px rgba(180,122,255,0.9), 0 0 54px rgba(180,122,255,0.6), 0 3px 0 #4a2a7a;
  }
  .tag { margin-top:18px; font-family:'PingFang SC','Segoe UI',sans-serif; font-size:26px; color:#e7d6ff; letter-spacing:0.04em; text-shadow:0 0 12px rgba(180,122,255,0.8); }
  .cta { position:absolute; left:64px; bottom:56px; font-family:'Arial Black','PingFang SC',sans-serif; font-size:30px; color:#ffe14a; letter-spacing:0.08em; text-shadow:0 0 14px rgba(255,225,74,0.7), 0 2px 0 #7a5a10; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${(await readFile(shot)).toString('base64')}">
  <div class="veil"></div>
  <div class="title-wrap"><div class="logo">ALIEN SIEGE</div><div class="tag">Laser-mark. Raise your shield. Hold the alley.</div></div>
  <div class="cta">12 WAVES · 4 WEAPONS</div>
</body></html>`);
await overlay.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });

await ctx.close();
await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
