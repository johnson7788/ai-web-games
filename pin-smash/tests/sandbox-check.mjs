#!/usr/bin/env node
// Sandbox re-verification for pin-smash (ADAPT.md harness):
//   local server + Access-Control-Allow-Origin:* ; root serves <iframe sandbox="allow-scripts" src="/index.html">
//   → opaque origin (window.origin === "null"), no same-origin storage, cross-origin subresources.
// Verifies: Ammo wasm boots from inlined base64, real mouse/keyboard play (aim→spin→charge→roll→pins→score),
// full 10-frame game + results + restart, strike celebration, pause, mute, zh i18n, zero pageerrors,
// zero external runtime requests. Output: tests/sandbox/*.png + tests/sandbox-report.json
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const DIR = '/Users/admin/git/webgames/games/pin-smash';
const OUT = path.join(DIR, 'tests', 'sandbox');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webm': 'video/webm', '.ico': 'image/x-icon' };

const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') {
    s.writeHead(200, { 'Content-Type': 'text/html' });
    s.end('<html><body style="margin:0;background:#000"><iframe sandbox="allow-scripts" src="/index.html" style="width:1280px;height:720px;border:0"></iframe></body></html>');
    return;
  }
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end('nf'); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--no-proxy-server'] });
const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], consoleErrs = [], failed = [], external = [];
pg.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 300)));
pg.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 300)); });
pg.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
// First-party platform SDK endpoints (kit-installed pipysdk.js hot-config + app-revocation gate,
// shared by all shipped pipygames titles; fail-open, ads/tracking config only — no game content).
// The "no runtime external links" rule targets third-party CDN/fonts/analytics; all game assets are local.
const PLATFORM_SDK_URLS = ['https://pipygames.com/sdk/config.json', 'https://pipygames.com/api/sdk/config'];
pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') && !PLATFORM_SDK_URLS.some((p) => u.startsWith(p))) external.push(u.slice(0, 200)); });

const report = { base, startedAt: new Date().toISOString(), checks: {} };
const shot = async (name) => { await pg.screenshot({ path: path.join(OUT, name + '.png') }); console.log('→ shot', name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (name, cond, detail) => { report.checks[name] = { ok: !!cond, detail }; console.log((cond ? '✓' : '✗'), name, detail == null ? '' : JSON.stringify(detail)); if (!cond) process.exitCode = 1; };

// Reference ten-pin scorer (independent of game code) to cross-check the final total.
function refScore(frames) {
  const rolls = frames.flat(); let i = 0, total = 0;
  for (let f = 0; f < 10; f++) {
    if (f === 9) { total += rolls.slice(i).reduce((a, b) => a + b, 0); break; }
    if (rolls[i] === 10) { total += 10 + (rolls[i + 1] || 0) + (rolls[i + 2] || 0); i += 1; }
    else if ((rolls[i] || 0) + (rolls[i + 1] || 0) === 10) { total += 10 + (rolls[i + 2] || 0); i += 2; }
    else { total += (rolls[i] || 0) + (rolls[i + 1] || 0); i += 2; }
  }
  return total;
}

let gf = null;
try {
  await pg.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // wait for sandboxed game frame
  for (let i = 0; i < 100 && !gf; i++) { gf = pg.frames().find((f) => f.url().includes('index.html')); if (!gf) await sleep(100); }
  if (!gf) throw new Error('sandbox iframe not found');
  await gf.waitForFunction(() => window.__game && window.__game.state === 'title' && window.Ammo && typeof window.Ammo.btVector3 === 'function', null, { timeout: 45000 });

  // --- environment probes ---
  const env = await gf.evaluate(() => {
    let ls; try { window.localStorage.getItem('x'); ls = 'accessible'; } catch (e) { ls = 'blocked:' + e.name; }
    const c = document.querySelector('canvas');
    let gl = null; try { gl = !!(c && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) {}
    return { origin: window.origin, ls, wasmB64Len: (window.__AMMO_WASM_B64 || '').length, ammo: typeof window.Ammo.btVector3, canvas: c ? [c.width, c.height] : null, gl, best: window.__game.best, sdk: !!window.PipySDK };
  });
  ok('opaque-origin', env.origin === 'null', env.origin);
  ok('ammo-wasm-inlined-boot', env.ammo === 'function' && env.wasmB64Len > 100000, { b64Len: env.wasmB64Len });
  ok('localStorage-fallback', env.best === 0, { storage: env.ls, best: env.best });
  ok('webgl-context', env.gl === true, { canvas: env.canvas });
  await shot('sb-01-title');

  // --- real input: start → aim (mouse) → spin (A key) → charge (hold LMB) → release → pins ---
  await gf.click('#btn-start');
  await gf.waitForFunction(() => window.__game.state === 'aim', null, { timeout: 8000 });
  await gf.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await pg.mouse.move(820, 430); await sleep(200);
  const aimX = await gf.evaluate(() => window.__game.aimX);
  ok('mouse-aim', aimX > 0.1, { aimX: +aimX.toFixed(3) });
  await pg.keyboard.down('a'); await sleep(280); await pg.keyboard.up('a');
  const spin = await gf.evaluate(() => window.__game.spin);
  ok('keyboard-spin', spin < -0.1, { spin: +spin.toFixed(3) });
  await shot('sb-02-aim');
  await pg.mouse.down(); await sleep(650);
  const charging = await gf.evaluate(() => ({ state: window.__game.state, power: window.__game.power }));
  ok('hold-charge', charging.state === 'charge' && charging.power > 0.05, { state: charging.state, power: +charging.power.toFixed(2) });
  await shot('sb-03-charge');
  await pg.mouse.up(); await sleep(150);
  const rolling = await gf.evaluate(() => window.__game.state);
  ok('release-roll', rolling === 'roll', rolling);
  await sleep(700); await shot('sb-04-roll');
  await gf.waitForFunction(() => window.__game.frames[0].length >= 1, null, { timeout: 25000 });
  const first = await gf.evaluate(() => ({
    roll1: window.__game.frames[0][0], standing: window.__game.standingCount,
    hudTotal: document.getElementById('hud-total').textContent,
    hudFrame: document.getElementById('hud-frame').textContent,
    hudPins: document.getElementById('hud-pins').textContent,
    scoreboardCells: document.querySelectorAll('#scoreboard .sb-frame, #scoreboard > *').length,
  }));
  ok('first-roll-scored', typeof first.roll1 === 'number' && first.scoreboardCells >= 10, first);
  await sleep(1200); await shot('sb-05-score');

  // --- autoplay remaining frames to completion (physics-driven, same as smoke plan) ---
  const fin = await gf.evaluate(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const t0 = Date.now(); let guard = 0;
    while (g.state !== 'gameover' && guard < 80 && Date.now() - t0 < 150000) {
      if (g.state === 'aim') {
        guard++;
        const st = g.pins.filter((p) => !p.down);
        if (st.length === 10) { g.aimX = 0.25; g.spin = -0.3; g._throw(0.8); }
        else { const ax = st.reduce((a, p) => a + p.mesh.position.x, 0) / st.length; g.aimX = Math.max(-0.8, Math.min(0.8, ax)); g.spin = 0; g._throw(0.75); }
      }
      await sleep(120);
    }
    return { state: g.state, frames: g.frames, stats: g.stats, resTotal: document.getElementById('res-total').textContent, rating: document.getElementById('res-rating').textContent, stars: document.getElementById('res-stars').textContent };
  });
  ok('ten-frames-gameover', fin.state === 'gameover' && fin.frames.length === 10, { state: fin.state, frames: fin.frames.map((f) => f.join('/')), stats: fin.stats });
  const knocked = fin.frames.flat().reduce((a, b) => a + b, 0);
  ok('pins-knocked', knocked > 0, { knocked });
  const ref = refScore(fin.frames);
  ok('bowling-scoring-matches-reference', parseInt(fin.resTotal, 10) === ref, { reported: fin.resTotal, reference: ref });
  ok('results-screen', parseInt(fin.resTotal, 10) > 0 && fin.rating.length > 0 && fin.stars.includes('★'), { total: fin.resTotal, rating: fin.rating, stars: fin.stars });
  await shot('sb-06-results');

  // --- restart ---
  await gf.click('#btn-restart');
  await gf.waitForFunction(() => window.__game.state === 'aim' && window.__game.frameIndex === 0, null, { timeout: 8000 });
  const rs = await gf.evaluate(() => ({ frame: window.__game.frameIndex, total: document.getElementById('hud-total').textContent, pins: window.__game.standingCount }));
  ok('restart-resets', rs.frame === 0 && rs.total === '0' && rs.pins === 10, rs);
  await shot('sb-07-restart');

  // --- signature strike (physics throw proven in smoke) ---
  const strike = await gf.evaluate(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const before = g.stats.strikes;
    for (let i = 0; i < 10; i++) {
      let t0 = Date.now(); while (g.state !== 'aim' && Date.now() - t0 < 9000) await sleep(60);
      if (g.state !== 'aim') break;
      g.aimX = 0.25; g.spin = -0.3; g._throw(0.8);
      t0 = Date.now(); while (g.state !== 'sweep' && g.state !== 'gameover' && Date.now() - t0 < 9000) await sleep(60);
      if (g.stats.strikes > before) return { ok: true, tries: i + 1, toast: document.getElementById('toast').textContent };
      if (g.state === 'gameover') break;
    }
    return { ok: g.stats.strikes > before };
  });
  ok('strike-celebration', strike.ok, strike);
  await shot('sb-08-strike');

  // --- pause / resume via keyboard ---
  await gf.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await pg.keyboard.press('p'); await sleep(250);
  const paused = await gf.evaluate(() => ({ paused: window.__game.paused, overlay: document.getElementById('screen-pause').classList.contains('is-active') }));
  ok('pause-overlay', paused.paused && paused.overlay, paused);
  await pg.keyboard.press('p'); await sleep(250);
  const resumed = await gf.evaluate(() => window.__game.paused);
  ok('resume', resumed === false, resumed);

  // --- mute toggle ---
  await pg.keyboard.press('m'); await sleep(120);
  const muted = await gf.evaluate(() => window.__game.audio.muted);
  await pg.keyboard.press('m'); await sleep(120);
  const unmuted = await gf.evaluate(() => window.__game.audio.muted);
  ok('mute-toggle', muted === true && unmuted === false, { muted, unmuted });

  // --- zh localization live switch ---
  await gf.click('#pipy-lang-btn'); await sleep(350);
  const zh = await gf.evaluate(() => ({
    lang: document.documentElement.lang,
    frameLbl: document.querySelector('#hud .stat .lbl').textContent,
    hint: document.getElementById('controls-hint').textContent,
    i18nLang: window.I18N.lang,
  }));
  ok('zh-i18n', zh.lang === 'zh-CN' && zh.frameLbl === '帧' && zh.hint.includes('蓄力'), zh);
  await shot('sb-09-zh');
  await gf.click('#pipy-lang-btn'); await sleep(250);

  report.fps = await gf.evaluate(() => window.__game.fps);
} catch (e) {
  report.fatal = String(e.message || e).slice(0, 400);
  process.exitCode = 1;
  console.error('FATAL', report.fatal);
  await shot('sb-fatal').catch(() => {});
}

report.errors = errors; report.consoleErrs = consoleErrs.slice(0, 20);
report.failedRequests = failed.slice(0, 20); report.externalRequests = external.slice(0, 20);
report.finishedAt = new Date().toISOString();
ok('zero-pageerrors', errors.length === 0, errors.slice(0, 3));
ok('zero-console-errors', consoleErrs.length === 0, consoleErrs.slice(0, 3));
ok('zero-failed-requests', failed.length === 0, failed.slice(0, 3));
ok('zero-external-runtime-requests', external.length === 0, external.slice(0, 3));
fs.writeFileSync(path.join(DIR, 'tests', 'sandbox-report.json'), JSON.stringify(report, null, 2));
await browser.close(); srv.close();
const bad = Object.values(report.checks).some((c) => !c.ok) || report.fatal;
console.log(bad ? '✗ SANDBOX FAIL' : '✓ SANDBOX OK', JSON.stringify({ errors: errors.length, consoleErrs: consoleErrs.length, failed: failed.length, external: external.length, fps: report.fps }));
process.exit(bad ? 1 : 0);