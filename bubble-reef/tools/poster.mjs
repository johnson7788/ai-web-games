// tools/poster.mjs — 生成 poster.jpg（1280×720）：真实玩法截图 + HTML 叠大标题/tagline
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { bestAim } from '../src/game/ai.js';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'poster.jpg');

async function main() {
  const { serve } = await import('/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs');
  const { server, port } = await serve(ROOT, 8600);
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 10000 });
  await page.click('#btn-start');
  await page.waitForTimeout(500);
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count()) { await skip.click({ force: true }).catch(() => {}); }
  await page.waitForTimeout(400);

  // 打一发，让截图带上「飞行中的泡泡 + 瞄准线」的张力瞬间
  const st = await page.evaluate(() => {
    const r = window.__ll.run;
    return { grid: r.grid.map((row) => (row ? row.map((c) => (c ? { c: c.c, gold: c.gold, wildcard: c.wildcard } : null)) : null)), parities: r.parities.slice(), current: r.current ? { c: r.current.c, wildcard: r.current.wildcard } : null, drift: r.level.drift };
  });
  const aim = bestAim(st.grid, st.parities, st.current.wildcard ? 0 : st.current.c, st.drift);
  await page.evaluate((a) => window.__ll.debug.fire(a || 0), aim ? aim.angle : 0);
  await page.waitForTimeout(220);

  const shotBuf = await page.screenshot({ type: 'png' });
  const base64 = shotBuf.toString('base64');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; font-family: 'Courier New', 'PingFang SC', sans-serif; }
  .bg { position:absolute; inset:0; background: url('data:image/png;base64,${base64}') center/cover no-repeat; }
  .shade { position:absolute; inset:0; background: radial-gradient(120% 90% at 50% 20%, rgba(2,20,30,0.0), rgba(1,14,20,0.78)); }
  .title { position:absolute; top:64px; left:0; right:0; text-align:center; }
  .logo { font-size:92px; font-weight:900; letter-spacing:6px; color:#c8fbff;
    text-shadow: 0 0 22px rgba(80,230,255,0.95), 0 0 60px rgba(30,160,200,0.7), 0 4px 0 #083a46, 0 8px 26px rgba(0,0,0,0.6); }
  .tag { margin-top:14px; font-size:26px; letter-spacing:2px; color:#bff6ff; text-shadow: 0 0 14px rgba(80,230,255,0.8), 0 2px 6px rgba(0,0,0,0.7); }
  .cta { position:absolute; left:0; right:0; bottom:40px; text-align:center; font-size:20px; color:#ffe27a; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
  </style></head><body>
  <div class="bg"></div><div class="shade"></div>
  <div class="title"><div class="logo">BUBBLE REEF</div><div class="tag">Aim · Shoot · Free the Jellyfish</div></div>
  <div class="cta">Match 3 · Drop the cluster · Beat the sinking tide</div>
  </body></html>`;

  const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await p2.setContent(html, { waitUntil: 'load' });
  await p2.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
  await browser.close();
  server.close();

  console.log(`poster.jpg written: ${OUT} (${(readFileSync(OUT).length / 1024).toFixed(0)}KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
