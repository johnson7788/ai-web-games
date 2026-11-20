// 生成上线海报：真实玩法画面 + 大标题贴纸字（HTML 叠字 → Playwright 截图）。
// 产出 poster.jpg（1280×720）与 poster-1920.jpg（1920×1080）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

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
await new Promise((r) => server.listen(8151, r));

async function shoot(deviceScaleFactor, out) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start(0);
  });
  await page.waitForTimeout(600);
  // 让敌人贴到玩家周围，形成「正在割草」的玩法画面
  await page.evaluate(() => {
    const s = window.__ll.sim();
    if (!s) return;
    const p = s.player;
    const list = s.enemies.slice(0, 6);
    list.forEach((e, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2 + 0.5;
      e.x = p.x + Math.cos(a) * (150 + (i % 3) * 24);
      e.y = p.y + Math.sin(a) * (108 + (i % 2) * 30);
    });
    if (s.gems.length < 6) {
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        s.gems.push({ x: p.x + Math.cos(a) * 90, y: p.y + Math.sin(a) * 70, value: 1, t: 0 });
      }
    }
    document.getElementById('hud').style.display = 'none';
  });
  await page.waitForTimeout(250);
  // 叠加海报标题（贴纸字）
  await page.evaluate(() => {
    const c = document.getElementById('game-container');
    let ov = document.getElementById('poster-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'poster-ov';
      ov.innerHTML =
        '<div class="pv-band"></div>' +
        '<h1 class="pv-title">BLADE<br>GARDEN</h1>' +
        '<p class="pv-sub">Guard the herb garden · Forge your Sword Intent</p>';
      c.appendChild(ov);
    }
    const st = document.createElement('style');
    st.id = 'poster-style';
    st.textContent = `
      #poster-ov { position: absolute; inset: 0; z-index: 30; pointer-events: none; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .pv-band { position:absolute; top:0; left:0; right:0; height:260px; background: linear-gradient(180deg, rgba(8,14,10,0.72), rgba(8,14,10,0.0)); }
      .pv-title { font-family: 'PingFang SC','Segoe UI',sans-serif; font-weight: 900; font-size: 118px; line-height: 0.96; text-align:center; letter-spacing: 0.04em;
        background: linear-gradient(180deg,#D8FFB0 0%,#7ED98A 48%,#2E9E5B 100%); -webkit-background-clip:text; background-clip:text; color:transparent;
        -webkit-text-stroke: 4px #1E4A2E; paint-order: stroke fill; filter: drop-shadow(0 8px 0 rgba(0,0,0,0.35)); }
      .pv-sub { margin-top: 22px; font-size: 27px; font-weight: 800; color: #fff; text-shadow: 0 3px 6px rgba(0,0,0,0.6); }
    `;
    if (!document.getElementById('poster-style')) document.head.appendChild(st);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
  await ctx.close();
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
await shoot(1, join(ROOT, 'poster.jpg'));
await shoot(1.5, join(ROOT, 'poster-1920.jpg'));
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('poster.jpg + poster-1920.jpg saved');
process.exit(0);
