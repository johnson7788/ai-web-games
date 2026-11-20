// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法图 + 发光大标题 + tagline
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const PORT = 8151;

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
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

// 1) 玩法图：注入 Boss 状态，隐藏 DOM UI，只截画布
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.evaluate(() => { window.__ll.start(); return true; });
await page.waitForTimeout(200);
await page.evaluate(() => {
  const r = window.__ll.run;
  r.phase = 'playing';
  r.wave = 12;
  r.scene = 2;
  r.hp = 64;
  r.targets = [{
    id: 99001, type: 'boss', x: 640, y: 200, w: 96, h: 84,
    hp: 1500, maxHp: 2600, vy: 12, score: 5000, crash: 60,
    shield: false, armor: true, hitFlash: 0, slowUntil: null, slowMult: 1, dead: false,
  }];
  r.bullets = [
    { id: 99002, x: 430, y: 250, vx: 520, vy: 0, damage: 60, bounces: 1, pierceLeft: 0, life: 2, targetsHit: [], roared: false },
    { id: 99003, x: 900, y: 150, vx: -480, vy: 0, damage: 60, bounces: 1, pierceLeft: 0, life: 2, targetsHit: [], roared: false },
  ];
  for (const id of ['hud', 'boss-bar']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  for (const s of document.querySelectorAll('.screen, .tutorial')) s.style.display = 'none';
});
await page.waitForTimeout(250);
const raw = await page.screenshot({ type: 'png' });
const gameplayB64 = raw.toString('base64');
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 2) 叠标题 + tagline 截图
const posterPage = await (await browser2()).newPage();
await posterPage.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#000;width:1280px;height:720px;overflow:hidden">
<img src="data:image/png;base64,${gameplayB64}" style="position:absolute;inset:0;width:1280px;height:720px;object-fit:cover">
<div style="position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(180deg,rgba(6,16,12,0.15) 0%,rgba(6,16,12,0.0) 40%,rgba(6,16,12,0.72) 100%)"></div>
<div style="position:absolute;left:64px;top:48px;font:800 88px/1 'Segoe UI',sans-serif;letter-spacing:0.10em;color:#effff0;text-shadow:0 0 22px rgba(127,208,122,0.95),0 0 60px rgba(127,208,122,0.55),0 4px 0 rgba(0,0,0,0.35)">CANNON<br>ECHO</div>
<div style="position:absolute;left:66px;top:270px;font:600 26px/1.4 'Segoe UI',sans-serif;color:#eafbe8;text-shadow:0 2px 12px rgba(0,0,0,0.8)">Bounce shots off the canyon walls.<br>Break every crate before it reaches the fortress.</div>
</body></html>`);
await posterPage.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await posterPage.context().browser().close().catch(() => {});
console.log('saved poster.jpg');

async function browser2() {
  return chromium.launch({ headless: true });
}
