// LAST LINE M4 音频自检：起静态服务 → Playwright 打开 audio-bench.html → 逐音效/场景测 RMS/峰值。
// 用法：cd games/stickman && node tools/audio-check.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch { /* try next */ }
}
if (!chromium) throw new Error('playwright not found');

const PORT = 8124;
const HOST = `http://127.0.0.1:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SFX = [
  'shot.pencil', 'shot.brush', 'shot.nib', 'hit', 'kill', 'ragdoll.thud',
  'dash', 'melee', 'reload', 'ink.pickup', 'hurt', 'wave.start', 'wave.clear',
  'act.change', 'boss.roar', 'death', 'splash', 'lore', 'boss.down',
  'ui.click', 'ui.hover', 'ui.pick', 'ui.back',
];
const SCENES = ['title', 'draft', 'blueprint', 'neon', 'wash', 'blank', 'ending'];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(800);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const requests = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('request', (r) => requests.push(r.url()));
page.on('requestfailed', (r) => failed.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('response', (r) => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });

async function measure(name, kind, ms) {
  return page.evaluate(async ({ name, kind, ms }) => {
    const A = window.AudioRef;
    if (kind === 'sfx') A.play(name);
    else { A.setScene(name); A.setIntensity(0.5); }
    let peak = 0; let rms = 0; let voices = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const s = A.getState();
      peak = Math.max(peak, s.peak || 0);
      rms = Math.max(rms, s.rms || 0);
      voices = Math.max(voices, s.voices || 0);
      await new Promise((r) => setTimeout(r, 12));
    }
    return { peak, rms, voices };
  }, { name, kind, ms });
}

const results = { sfx: [], scenes: [] };
let ok = true;

try {
  await page.goto(`${HOST}/tools/audio-bench.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__benchReady === true);

  // init 前调用应静默失败，不抛异常
  await page.evaluate(() => window.AudioRef.play('hit'));
  await page.evaluate(() => window.AudioRef.event([{ type: 'shot', weapon: 'pencil' }]));

  // 解锁
  await page.locator('#unlock').click();
  await page.waitForFunction(() => window.AudioRef.getState().ready === true);

  for (const name of SFX) {
    const m = await measure(name, 'sfx', 300);
    results.sfx.push({ name, ...m });
    if (m.peak <= 0.01) ok = false;
  }

  for (const id of SCENES) {
    const m = await measure(id, 'scene', 1000);
    results.scenes.push({ name: id, ...m });
    if (m.peak <= 0.01) ok = false;
    await sleep(1500); // 等上一幕 1.2s 淡出完成，避免串音
  }
  await page.evaluate(() => window.AudioRef.setScene(null));

  // 事件路由冒烟：逐类触发，仅验证不抛异常、不产生错误
  const eventNames = ['shot', 'shotHit', 'hit', 'kill', 'splash', 'dash', 'melee', 'reload', 'pickup', 'hurt', 'waveStart', 'waveClear', 'actStart', 'actClear', 'bossPhase', 'bossDown', 'dead', 'lore'];
  await page.evaluate((names) => {
    window.AudioRef.event(names.map((n) => ({ type: n, weapon: 'pencil', kind: 'ink' })));
  }, eventNames);
  await sleep(400);

  results.state = await page.evaluate(() => {
    const s = window.AudioRef.getState();
    return { ready: s.ready, scene: s.scene, intensity: s.intensity, muted: s.muted, voices: s.voices };
  });
  results.consoleErrors = errors;
  results.failed = failed;
  results.requests = requests;

  const external = requests.filter((u) => !u.startsWith(HOST));
  results.externalRequests = external;

  const allSfxHeard = results.sfx.every((s) => s.peak > 0.01);
  const allScenesHeard = results.scenes.every((s) => s.peak > 0.01);
  ok = ok && errors.length === 0 && failed.length === 0 && external.length === 0 && allSfxHeard && allScenesHeard;

  results.ok = ok;
  results.summary = {
    sfxCount: SFX.length,
    allSfxHeard,
    allScenesHeard,
    consoleErrors: errors.length,
    failed,
    externalRequests: external,
  };

  console.log('=== SFX ===');
  console.table(results.sfx.map((s) => ({ name: s.name, peak: s.peak.toFixed(4), rms: s.rms.toFixed(4), voices: s.voices })));
  console.log('=== SCENES ===');
  console.table(results.scenes.map((s) => ({ name: s.name, peak: s.peak.toFixed(4), rms: s.rms.toFixed(4), voices: s.voices })));
  console.log('=== SUMMARY ===');
  console.log(JSON.stringify(results.summary, null, 2));
} catch (error) {
  errors.push(`SCRIPT ${error.stack || error.message}`);
  ok = false;
} finally {
  await browser.close().catch(() => {});
  server.kill();
  fs.mkdirSync(path.join(root, 'tests', 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tests', 'artifacts', 'audio-report.json'), JSON.stringify({ ok, ...results, consoleErrors: errors, failed, requests }, null, 2));
  console.log(`\nRESULT ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}
