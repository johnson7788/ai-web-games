// Sandbox re-test: serve the game with ACAO:* behind <iframe sandbox="allow-scripts">,
// then play inside the iframe (pointer lock is denied there — fallback must keep the game alive).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = '/Users/admin/git/webgames/games/haunted-house-3d';
const out = path.join(dir, 'tests/sandbox');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.ico': 'image/x-icon' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    s.end('<!doctype html><html><body style="margin:0;background:#222"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], consoleErrs = [], failed = [];
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 760 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
const report = { mode: 'iframe sandbox="allow-scripts" + ACAO:*', startedAt: new Date().toISOString() };
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) throw new Error('game iframe not found');
  await page.screenshot({ path: path.join(out, 'sandbox-title.png') });
  // start the game inside the sandboxed iframe
  await frame.click('#title-screen');
  await sleep(2500);
  const st1 = await frame.evaluate(() => {
    const g = window.__HAUNTED_GAME__;
    return { state: g.state, fallback: g.fallbackLook, enabled: g.player.enabled, locked: !!document.pointerLockElement, z: g.player.position.z, battery: g.player.battery };
  });
  report.afterStart = st1;
  if (st1.state !== 'playing') throw new Error('not playing in sandbox');
  if (!st1.enabled) throw new Error('player not enabled — pointer-lock fallback failed');
  // real keyboard movement inside the iframe
  await frame.click('#game', { position: { x: 640, y: 360 } });
  await page.keyboard.down('w'); await sleep(2500); await page.keyboard.up('w');
  await page.keyboard.down('ArrowLeft'); await sleep(600); await page.keyboard.up('ArrowLeft');
  await sleep(800);
  const st2 = await frame.evaluate(() => {
    const g = window.__HAUNTED_GAME__;
    return { z: g.player.position.z, yaw: g.player.yaw, battery: g.player.battery, objective: document.getElementById('objective').textContent };
  });
  report.afterMove = st2;
  if (st2.z >= st1.z - 1) throw new Error(`WASD movement failed in sandbox: ${st1.z} -> ${st2.z}`);
  if (Math.abs(st2.yaw) < 0.5) throw new Error('arrow-key look failed in sandbox');
  if (st2.battery >= st1.battery) throw new Error('battery did not drain — update loop not running');
  // drag-to-look fallback with real mouse events
  const yawBefore = st2.yaw;
  await page.mouse.move(650, 380); await page.mouse.down();
  await page.mouse.move(850, 380, { steps: 10 }); await page.mouse.up();
  await sleep(400);
  const yawAfter = await frame.evaluate(() => window.__HAUNTED_GAME__.player.yaw);
  report.dragLook = { yawBefore, yawAfter };
  if (Math.abs(yawAfter - yawBefore) < 0.1) throw new Error('drag-to-look fallback failed');
  // interact: aim at the foyer note via hook, press real E
  await frame.evaluate(() => {
    const g = window.__HAUNTED_GAME__;
    g.player.yaw = 0; g.player.pitch = 0; g.player.position.set(0, 1.62, 6.4);
    const note = g.house.interactables.find((m) => m.userData.interact && m.userData.interact.type === 'note' && m.position.z > 0);
    const p = g.player.position, t = note.position;
    const dx = t.x - p.x, dz = t.z - p.z, dy = t.y - 1.62;
    g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  });
  await sleep(400);
  await page.keyboard.press('e');
  await sleep(700);
  const noteOpen = await frame.evaluate(() => window.__HAUNTED_GAME__.hud.noteOpen);
  report.noteOpen = noteOpen;
  if (!noteOpen) throw new Error('E interact failed in sandbox');
  await page.screenshot({ path: path.join(out, 'sandbox-note.png') });
  await page.keyboard.press('e');
  await sleep(400);
  // zh switch inside sandbox
  await frame.evaluate(() => window.I18N.setLang('zh'));
  await sleep(600);
  report.zhObjective = await frame.evaluate(() => document.getElementById('objective').textContent);
  await page.screenshot({ path: path.join(out, 'sandbox-play-zh.png') });
  report.ok = true;
} catch (e) {
  report.ok = false;
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors; report.consoleErrs = consoleErrs.slice(0, 20); report.failedRequests = failed.slice(0, 20);
report.finishedAt = new Date().toISOString();
await browser.close();
srv.close();
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
console.log(report.ok && errors.length === 0 ? '✓ SANDBOX OK' : '✗ SANDBOX FAIL', JSON.stringify({ errors: errors.length, consoleErrs: consoleErrs.length, failed: failed.length, fatal: report.fatal || null }));
process.exit(report.ok && errors.length === 0 ? 0 : 1);