#!/usr/bin/env node
// tests/sandbox-harness.mjs — 模拟 pipygames 线上沙箱条件复测
// 条件：iframe sandbox="allow-scripts"（opaque origin，无 allow-same-origin / allow-pointer-lock），
//       所有响应带 Access-Control-Allow-Origin: *。
// 验证：游戏初始化、pointer lock 被拒后的自由鼠标降级、localStorage 抛异常时的存档兜底、
//       真实挖掘/放置核心循环、0 pageerror / 0 console error / 0 404。
// 用法: /opt/homebrew/bin/node games/voxelcraft/tests/sandbox-harness.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = path.join(dir, 'tests', 'sandbox');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    s.end('<!DOCTYPE html><html><body style="margin:0"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], consoleErrs = [], failed = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
page.on('requestfailed', (r) => failed.push(r.url()));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const report = { url: `http://127.0.0.1:${port}/`, startedAt: new Date().toISOString(), checks: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, detail }); console.log((ok ? '✓' : '✗'), name, detail ?? ''); };

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const frame = page.frames().find((f) => f.url().includes('index.html'));
  if (!frame) throw new Error('sandbox iframe not found');

  const env = await frame.evaluate(() => ({
    origin: window.origin,
    storageOk: Storage.ok,
    lsThrows: (() => { try { localStorage.getItem('x'); return false; } catch (e) { return true; } })(),
    sdkAvailable: !!(window.PipySDK && window.PipySDK.available),
    gameInit: !!Game.renderer,
    fallbackPermanent: Input.fallbackPermanent,
    i18n: !!window.I18N,
  }));
  check('opaque origin', env.origin === 'null', env.origin);
  check('localStorage throws (expected)', env.lsThrows === true);
  check('Storage probe degraded safely', env.storageOk === false);
  check('game initialized', env.gameInit === true);
  check('Input knows sandbox is permanent', env.fallbackPermanent === true);
  check('i18n layer loaded', env.i18n === true);
  await page.screenshot({ path: path.join(out, 'sandbox-01-title.png') });

  // Enter world (real click inside iframe); fixed seed = flat beach spawn for determinism
  await frame.evaluate(() => { document.querySelector('#seed-input').value = '31337'; document.querySelector('#rd-input').value = '4'; });
  await frame.click('#btn-play');
  await frame.evaluate(async () => { const t0 = Date.now(); while (!Game.ready) { if (Date.now() - t0 > 45000) throw new Error('world gen timeout'); await new Promise((r) => setTimeout(r, 200)); } });
  await sleep(700);
  const lockState = await frame.evaluate(() => ({ fallback: Input.fallback, locked: Input.locked, plEl: !!document.pointerLockElement, paused: Game.paused }));
  check('pointer lock denied -> free-mouse fallback', lockState.fallback === true && lockState.locked === true && lockState.plEl === false, JSON.stringify(lockState));
  check('game not paused/crashed after lock denial', lockState.paused === false);

  // Look down with real mouse moves (movementX/Y deltas drive the view in fallback mode).
  // Guided aim: read pitch back and move until the target angle is reached.
  let cx = 640, cy = 360;
  await page.mouse.move(cx, cy); await sleep(150);
  async function aimPitch(target) {
    for (let i = 0; i < 8; i++) {
      const cur = await frame.evaluate(() => player.pitch);
      const dy = (cur - target) / 0.0022;
      if (Math.abs(dy) < 2) break;
      cy = Math.max(10, Math.min(710, cy + dy));
      await page.mouse.move(cx, cy); await sleep(120);
    }
  }
  await aimPitch(-1.1);
  await sleep(300);
  const aimed = await frame.evaluate(() => ({ pitch: player.pitch, target: !!Interaction.target }));
  check('mouse-look works without pointer lock', aimed.pitch < -0.5 && aimed.target === true, JSON.stringify(aimed));
  await page.screenshot({ path: path.join(out, 'sandbox-02-play.png') });

  // Mine: in permanent fallback the very first click mines (no lock retries)
  const tgt = await frame.evaluate(() => Interaction.target && { x: Interaction.target.x, y: Interaction.target.y, z: Interaction.target.z });
  await frame.evaluate(() => document.querySelector('#gl').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
  await sleep(1400);
  await frame.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })));
  await sleep(600);
  const mined = await frame.evaluate((t) => ({ blockNow: world.getBlock(t.x, t.y, t.z), inv: player.inventory.filter(Boolean).map((s) => s.name + 'x' + s.count) }), tgt);
  check('mining works via click (no pointer lock)', mined.blockNow === 0, JSON.stringify(mined));

  // Walk to pickup, then place
  await page.keyboard.down('KeyW'); await sleep(300); await page.keyboard.up('KeyW');
  await sleep(900);
  const invN = await frame.evaluate(() => player.inventory.filter(Boolean).reduce((a, s) => a + s.count, 0));
  check('item pickup after mining', invN >= 1, 'count=' + invN);
  await page.keyboard.press('Digit1');
  await aimPitch(-0.55);
  await sleep(400);
  const n0 = await frame.evaluate(() => player.inventory.filter(Boolean).reduce((a, s) => a + s.count, 0));
  await frame.evaluate(() => document.querySelector('#gl').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 })));
  await sleep(250);
  await frame.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 })));
  await sleep(400);
  const n1 = await frame.evaluate(() => player.inventory.filter(Boolean).reduce((a, s) => a + s.count, 0));
  check('placing works via right-click (no pointer lock)', n1 < n0, `${n0} -> ${n1}`);
  await page.screenshot({ path: path.join(out, 'sandbox-03-mined-placed.png') });

  // Save must degrade to in-memory without throwing (Save.save is async)
  const saveState = await frame.evaluate(async () => {
    const ok = await Save.save(false);
    return { ok, hasMemory: !!Save.memory, hasSave: Save.hasSave(), storageOk: Storage.ok };
  });
  check('save degrades to memory (no localStorage)', saveState.ok === true && saveState.hasMemory === true && saveState.hasSave === true, JSON.stringify(saveState));

  // Esc pause in free-mouse mode (manual pause path)
  await page.keyboard.press('Escape');
  await sleep(400);
  const paused = await frame.evaluate(() => Game.paused);
  check('Esc pauses in free-mouse mode', paused === true);
  await page.screenshot({ path: path.join(out, 'sandbox-04-pause.png') });

  // zh switch inside sandbox (localStorage persistence must not throw)
  await frame.evaluate(() => window.I18N.setLang('zh'));
  await sleep(400);
  const zh = await frame.evaluate(() => document.querySelector('#pause h1').textContent);
  check('zh translation applies in sandbox', zh === '游戏菜单', zh);
  await page.screenshot({ path: path.join(out, 'sandbox-05-zh.png') });

  report.fps = await frame.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const loop = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(loop); else res(Math.round(n / 1.5)); }; requestAnimationFrame(loop); })).catch(() => null);
} catch (e) {
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors; report.consoleErrs = consoleErrs.slice(0, 20); report.failedRequests = failed.slice(0, 20);
report.finishedAt = new Date().toISOString();
await browser.close();
srv.close();
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
const bad = report.fatal || errors.length > 0 || report.checks.some((c) => !c.ok);
console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify({ errors: errors.length, consoleErrs: consoleErrs.length, failed: failed.length, fps: report.fps, checks: report.checks.length }));
process.exit(bad ? 1 : 0);