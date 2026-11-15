// tests/sandbox.mjs — 沙箱复测：模拟 pipygames 线上 iframe（sandbox="allow-scripts"，opaque origin）
// 服务所有响应带 Access-Control-Allow-Origin:*；验证 GLB fetch / 核心玩法 / 指针锁定降级 / 双语 / 0 pageerror
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const dir = path.resolve(import.meta.dirname, '..');
const out = import.meta.dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.webm': 'video/webm' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<!DOCTYPE html><html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(dir, p);
  if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 760 } });
const page = await ctx.newPage();
const errors = [], consoleErrs = [], warns = [], failed = [];
page.on('pageerror', e => errors.push(String(e.message || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); else if (m.type() === 'warning') warns.push(m.text().slice(0, 200)); });
page.on('requestfailed', r => failed.push(r.url()));
page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

const report = { startedAt: new Date().toISOString(), checks: {} };
const ok = (k, v, extra) => { report.checks[k] = { ok: !!v, ...(extra ? { detail: extra } : {}) }; console.log((v ? '✓' : '✗'), k, extra ?? ''); };

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await sleep(7000);
  const frame = page.frames().find(f => f.url().includes('index.html'));
  if (!frame) throw new Error('iframe not found');

  // 1) opaque origin confirmed + module booted
  // (this Chromium's location.origin serializes from the URL even when sandboxed;
  //  window.origin + localStorage SecurityError are the reliable opaque signals)
  const origin = await frame.evaluate(() => { let ls = 'ok'; try { localStorage.setItem('__t', '1'); } catch (e) { ls = e.name; } return { win: window.origin, ls }; });
  ok('opaque-origin', origin.win === 'null' && origin.ls === 'SecurityError', JSON.stringify(origin));
  const booted = await frame.evaluate(() => !!window.__NULLSTERN);
  ok('module-boot', booted);

  // 2) GLB fetch under opaque origin (the critical sandbox question)
  const glbFetch = await frame.evaluate(async () => {
    try { const r = await fetch('./assets/enemy.glb'); if (!r.ok) return { ok: false, status: r.status }; const b = await r.arrayBuffer(); return { ok: true, bytes: b.byteLength }; }
    catch (e) { return { ok: false, err: String(e) }; }
  });
  ok('fetch-glb-opaque', glbFetch.ok, JSON.stringify(glbFetch));
  const ready = await frame.evaluate(() => window.__NULLSTERN.enemiesReady);
  ok('enemy-glb-loaded', ready);
  await page.screenshot({ path: path.join(out, 'sandbox-title.png') });

  // 3) real play: click intro -> E -> aim+fire bot 8s
  await frame.click('#intro');
  await sleep(600);
  await page.keyboard.press('KeyE');
  await sleep(3000);
  const played = await frame.evaluate(async () => {
    const G = window.__NULLSTERN, W = window;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const mev = (t, x, y) => W.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0 }));
    const kev = (t, c) => W.dispatchEvent(new KeyboardEvent(t, { bubbles: true, code: c }));
    const v = new G.THREE.Vector3(); const held = {};
    const hold = (c, on) => { if (!!held[c] === on) return; held[c] = on; kev(on ? 'keydown' : 'keyup', c); };
    const t0 = performance.now(); let lastKick = 0;
    mev('mousedown', innerWidth / 2, innerHeight / 2);
    while (performance.now() - t0 < 8000) {
      if (!G.started) break;
      let best = null, bd = 1e9;
      for (const e of G.enemies) { if (e.state === 'dying' || e.state === 'spawning') continue; const d = Math.hypot(e.container.position.x - G.player.position.x, e.container.position.z - G.player.position.z); if (d < bd) { bd = d; best = e; } }
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(c => hold(c, false));
      if (best) {
        v.set(best.container.position.x, 0.2, best.container.position.z).project(G.camera);
        mev('mousemove', (v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight);
        if (bd < 2.6 && performance.now() - lastKick > 4200) { kev('keydown', 'KeyF'); kev('keyup', 'KeyF'); lastKick = performance.now(); }
        if (bd < 4.5) { const px = G.player.position.x, pz = G.player.position.z; let ax = px - best.container.position.x, az = pz - best.container.position.z; if (Math.abs(px) > 16 || Math.abs(pz) > 10) { ax = -px; az = -pz; } if (Math.abs(ax) > Math.abs(az)) hold(ax > 0 ? 'KeyD' : 'KeyA', true); else hold(az > 0 ? 'KeyS' : 'KeyW', true); }
      }
      await sleep(110);
    }
    ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(c => hold(c, false));
    mev('mouseup', innerWidth / 2, innerHeight / 2);
    return { score: G.score, level: G.level, hp: Math.round(G.hp), started: G.started };
  });
  ok('core-loop-score>0', played.score > 0, JSON.stringify(played));
  await page.screenshot({ path: path.join(out, 'sandbox-combat.png') });
  if (!played.started) { await frame.click('#over'); await sleep(1000); }   // died during bot -> redeploy so pause/FP tests run in-game

  // 4) pointer lock denied in sandbox -> FP fallback must not crash, must still fire
  await page.keyboard.press('KeyR');   // ensure a full mag so the fire check is deterministic
  await sleep(1600);
  await page.keyboard.press('KeyV');
  await sleep(800);
  const fpState = await frame.evaluate(() => ({ lock: document.pointerLockElement ? 'locked' : 'none', ammo: window.__NULLSTERN.ammo }));
  await frame.evaluate(() => { window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 640, clientY: 300 })); window.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 640, clientY: 300 })); });
  await sleep(700);
  await frame.evaluate(() => { window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); });
  const fpAfter = await frame.evaluate(() => ({ alive: !!window.__NULLSTERN, ammo: window.__NULLSTERN.ammo }));
  ok('fp-pointerlock-fallback', fpAfter.alive && fpAfter.ammo < fpState.ammo, JSON.stringify({ before: fpState, after: fpAfter }));
  await page.keyboard.press('KeyV');
  await sleep(400);

  // 5) zh switch: dynamic HUD must translate
  await frame.click('#pipy-lang-btn');
  await sleep(400);
  const zhHud = await frame.evaluate(() => ({ lvl: document.getElementById('lvl').textContent, wave: document.getElementById('wave').textContent, prompt: document.getElementById('prompt').textContent }));
  ok('zh-hud', /等级/.test(zhHud.lvl), JSON.stringify(zhHud));
  await page.screenshot({ path: path.join(out, 'sandbox-zh.png') });

  // 6) pause menu + resume
  await page.keyboard.press('Escape');
  await sleep(400);
  const pausedShown = await frame.evaluate(() => document.getElementById('pause').classList.contains('show'));
  ok('pause-menu', pausedShown);
  await page.keyboard.press('Escape');
  await sleep(300);
} catch (e) {
  report.fatal = String(e.message || e).split('\n')[0];
}
report.errors = errors; report.consoleErrs = consoleErrs; report.warns = warns.slice(0, 10); report.failedRequests = failed;
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(out, 'sandbox-report.json'), JSON.stringify(report, null, 2));
await browser.close(); srv.close();
const bad = report.fatal || errors.length > 0 || Object.values(report.checks).some(c => !c.ok);
console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify({ errors: errors.length, consoleErrs: consoleErrs.length, failed: failed.length }));
process.exit(bad ? 1 : 0);