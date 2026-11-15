// Quick boot + deploy probe (fast iteration before the full smoke run).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], cerr = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text().slice(0, 200)); });
page.on('response', (r) => { if (r.status() >= 400) cerr.push(`${r.status()} ${r.url()}`); });

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__READY__ === true && document.getElementById('sw-deploy') && !document.getElementById('sw-deploy').disabled, null, { timeout: 60000 });
console.log('ready in', Date.now() - t0, 'ms');
await page.screenshot({ path: path.join(dir, 'tests/probe-title.png') });
await page.click('#sw-deploy');
await page.waitForTimeout(1500);
// aim + fire + move
await page.mouse.move(640, 360);
await page.mouse.move(700, 350, { steps: 5 });
await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
await page.keyboard.down('w'); await page.waitForTimeout(1000); await page.keyboard.up('w');
const state = await page.evaluate(() => {
  const e = window.__ENGINE__;
  const p = e.ctx.peek('player'), w = e.ctx.peek('weapons'), d = e.ctx.get('director'), ai = e.ctx.peek('ai');
  return {
    locked: e.input.pointerLocked, fallback: e.input.fallbackAim, blocked: e.input.lockBlocked,
    fired: w.stats.fired, ammo: w.ammo.mag, pos: { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2) },
    yaw: +p.movement.yaw.toFixed(3), health: p.health.value,
    director: d.state, agents: ai.stats.agents, alive: ai.stats.alive,
    audio: window.__AUDIO__?.running ?? false,
  };
});
console.log(JSON.stringify(state, null, 1));
await page.screenshot({ path: path.join(dir, 'tests/probe-play.png') });
console.log('errors', errors, 'consoleErrs', cerr);
await browser.close();
srv.close();
process.exit(errors.length ? 1 : 0);