// QA: traversability of levels 3-6 with a mover-aware autopilot. Not shipped.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const dir = '/Users/admin/git/webgames/games/marble-dash';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dir, p); if (!fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

await page.evaluate(() => {
  window.__qa = (timeoutMs = 120000) => new Promise((resolve) => {
    const M = window.__marble; const wps = M.waypoints();
    let wi = 0; const held = {};
    const set = (k, on) => { if (!!held[k] === on) return; held[k] = on; on ? M.press(k) : M.release(k); };
    const releaseAll = () => { for (const k in held) set(k, false); };
    const t0 = performance.now();
    const tick = () => {
      const s = M.state();
      const b = s.ball;
      if (s.phase === 'clear' || s.phase === 'complete') { releaseAll(); resolve('CLEAR t=' + s.time + ' gems=' + s.gems + '/' + s.gemsTotal + ' lives=' + s.lives); return; }
      if (s.phase === 'gameover') { releaseAll(); resolve('GAMEOVER @wp' + wi + ' ball=' + JSON.stringify({ x: +b.x.toFixed(2), z: +b.z.toFixed(2) })); return; }
      if (performance.now() - t0 > timeoutMs) { releaseAll(); resolve('TIMEOUT @wp' + wi + ' ball=' + JSON.stringify({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2) })); return; }
      if (s.phase !== 'playing') { releaseAll(); requestAnimationFrame(tick); return; }
      let wp = wps[Math.min(wi, wps.length - 1)];
      if (wi > 0 && Math.hypot(wp[0] - b.x, wp[1] - b.z) > 16) { wi = 0; wp = wps[0]; }
      if (Math.hypot(wp[0] - b.x, wp[1] - b.z) < 1.5 && wi < wps.length - 1) wi++;
      wp = wps[Math.min(wi, wps.length - 1)];
      let tx = wp[0], tz = wp[1];
      // mover awareness
      let onMover = null;
      for (const m of s.movers) {
        if (Math.abs(b.x - m.x) < m.w / 2 + 0.4 && Math.abs(b.z - m.z) < m.d / 2 + 0.4 && b.y < 1.4) onMover = m;
      }
      if (onMover) {
        tx = onMover.x + (wp[0] - onMover.x) * 0.5;
      } else {
        for (const m of s.movers) {
          const ahead = m.z < b.z - 0.8 && m.z > wp[1] - 3;
          if (!ahead) continue;
          if (m.axis === 'x') {
            if (Math.abs(m.x - b.x) > 1.3 && b.z > m.z + m.d / 2) { tz = m.z + m.d / 2 + 1.1; tx = b.x * 0.3; }
          } else {
            if (m.z + m.d / 2 < -20.4 && b.z > -21.5) { tz = -20.2; tx = 0; }
          }
        }
        // spinner timing: wait at pad edge until arm is side-on, then dash
        for (const sp of s.spinners) {
          if (!s.grounded || b.z <= sp.z + sp.len / 2 + 0.5) continue;
          const dist = Math.hypot(sp.x - b.x, sp.z - b.z);
          if (dist < sp.len / 2 + 5 && Math.abs(Math.sin(sp.angle)) >= 0.4) { tz = sp.z + sp.len / 2 + 1.6; tx = sp.x; }
        }
      }
      const dx = tx - b.x, dz = tz - b.z;
      const last = wi >= wps.length - 1;
      const kp = last ? 1.1 : 1.5, kd = 1.3, dead = 0.3;
      const ax = dx * kp - b.vx * kd, az = dz * kp - b.vz * kd;
      set('KeyW', az < -dead); set('KeyS', az > dead);
      set('KeyD', ax > dead); set('KeyA', ax < -dead);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});

for (const idx of [5]) {
  await page.evaluate((i) => window.__marble.start(i), idx);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => window.__qa());
  console.log(`L${idx + 1}:`, r);
  await page.screenshot({ path: path.join(dir, `tests/qa-l${idx + 1}.png`) });
  await page.waitForTimeout(1200);
}
console.log('pageerrors:', errors);
await browser.close(); server.close();