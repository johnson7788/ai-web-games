// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：真实玩法截图 + 发光大标题 + tagline。
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8420);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('neo-tetra:tutorial-done', 'true'));
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);

// 跑一小段 greedy，让画面有堆叠晶块与分数。
await page.evaluate(() => {
  const g = window.G;
  function heights(b) { const h = new Array(10).fill(0); for (let x = 0; x < 10; x += 1) for (let y = 0; y < 20; y += 1) if (b[y][x] !== 0) { h[x] = 20 - y; break; } return h; }
  function holes(b) { let n = 0; for (let x = 0; x < 10; x += 1) { let s = false; for (let y = 0; y < 20; y += 1) { if (b[y][x] !== 0) s = true; else if (s) n += 1; } } return n; }
  function bump(b) { const h = heights(b); let s = 0; for (let x = 1; x < 10; x += 1) s += Math.abs(h[x] - h[x - 1]); return s; }
  function best(run, type) {
    let best = null;
    for (let rot = 0; rot < 4; rot += 1) for (let x = 0; x < 10; x += 1) {
      const d = g.sim.dropResult(run.board, type, rot, x); if (!d.ok) continue;
      const after = g.sim.placeCells(run.board, d.cells, 1);
      const cleared = g.sim.clearableRows(after, { narrow: run.narrow });
      const final = g.sim.clearRows(after, cleared);
      const agg = heights(final).reduce((a, v) => a + v, 0);
      const c = agg * 0.51 + holes(final) * 0.76 + bump(final) * 0.18 - cleared.length * 10;
      if (!best || c < best.c) best = { rot, x };
    }
    return best;
  }
  for (let k = 0; k < 40; k += 1) {
    const run = g.run; if (!run || run.phase !== 'playing' || !run.active) continue;
    const p = best(run, run.active.type); const a = run.active; const input = {};
    if (!p) { run.step({ hardDrop: true }); continue; }
    if (a.rot !== p.rot) input[(p.rot - a.rot + 4) % 4 <= 2 ? 'rotateCW' : 'rotateCCW'] = true;
    else if (a.x < p.x) input.moveRight = true;
    else if (a.x > p.x) input.moveLeft = true;
    else input.hardDrop = true;
    run.step(input);
  }
});
await page.waitForTimeout(300);

// 叠大标题 + tagline（发光描边），截图存 jpg。
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-ov';
  ov.innerHTML =
    '<div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'background:radial-gradient(ellipse at 50% 40%, rgba(24,10,2,0.15) 0%, rgba(10,4,0,0.55) 100%);z-index:100;pointer-events:none;">' +
    '<div style="font-family:monospace;font-weight:800;font-size:120px;letter-spacing:0.18em;color:#fff4e0;' +
    'text-shadow:0 0 18px #ffb45f,0 0 46px rgba(255,120,60,0.85),0 0 90px rgba(255,90,40,0.6);">NEO TETRA</div>' +
    '<div style="font-family:monospace;font-size:30px;letter-spacing:0.12em;color:#ffd166;' +
    'text-shadow:0 0 12px rgba(255,209,102,0.9);">DROP · SMELT · IGNITE THE FURNACE</div>' +
    '</div>';
  document.body.appendChild(ov);
});
await page.waitForTimeout(200);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
console.log(`poster.jpg written: ${OUT}`);

await browser.close();
server.close();
