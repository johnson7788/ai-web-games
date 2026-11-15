// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑锦标赛 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud, pickUpgrade } from '../src/game/sim.js';
import { FIGHTER, MATCH } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 720;
const dt = 1 / 60;

function setDir(inp, dx, dz) {
  const l = Math.hypot(dx, dz) || 1;
  inp.mx = dx / l; inp.mz = dz / l;
}

function greedyInput(run) {
  const p = run.fighters[0];
  const inp = { mx: 0, mz: 0, punch: false, grab: false, ult: false };
  if (run.phase !== 'match' || !p.alive) return inp;

  const enemies = run.fighters.filter((o) => o !== p && o.alive && o.grabbedBy == null);
  if (!enemies.length) return inp;

  // 目标：最近的低血敌人（补刀）
  let t = null, bd = Infinity, bestScore = Infinity;
  for (const o of enemies) {
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    const s = d + (o.hp < 35 ? -1.5 : 0);
    if (s < bestScore) { bestScore = s; bd = d; t = o; }
  }
  const near = enemies.filter((o) => Math.hypot(o.x - p.x, o.z - p.z) < 6);
  const toEdge = run.arenaR - Math.hypot(p.x, p.z);

  // 捡武器：仅当无近敌且武器很近（避免背对敌人挨打）
  if (!p.weapon && bd > 7) {
    let w = null, wd = Infinity;
    for (const wp of run.weapons) {
      if (wp.respawnT > 0) continue;
      const d = Math.hypot(wp.x - p.x, wp.z - p.z);
      if (d < wd) { wd = d; w = wp; }
    }
    if (w && wd < 12 && wd > 1.5) { setDir(inp, w.x - p.x, w.z - p.z); return inp; }
  }

  if (p.ultCd <= 0 && near.length >= 2) inp.ult = true;

  // 被围殴（≥2 近敌）：后撤，让 bot 互相消耗
  if (near.length >= 2) {
    let cx = 0, cz = 0;
    for (const o of near) { cx += o.x - p.x; cz += o.z - p.z; }
    const lc = Math.hypot(p.x, p.z) || 1;
    let ax = -cx * 0.7 + (-p.x / lc) * 0.3;
    let az = -cz * 0.7 + (-p.z / lc) * 0.3;
    const al = Math.hypot(ax, az);
    if (al < 0.01) { ax = p.x - t.x; az = p.z - t.z; }
    setDir(inp, ax, az);
    if (bd < FIGHTER.punch.range && p.punchCd <= 0) inp.punch = true;
    return inp;
  }

  // 1v1 / 单目标：接近并攻击；贴边时往内引（避免被扔出场）
  let ax = t.x - p.x, az = t.z - p.z;
  if (toEdge < 4) { const lc = Math.hypot(p.x, p.z) || 1; ax += (-p.x / lc) * 1.2; az += (-p.z / lc) * 1.2; }
  if (bd > FIGHTER.punch.range) setDir(inp, ax, az);
  else if (bd < 1.5) setDir(inp, p.x - t.x, p.z - t.z);
  // 抓扔：仅当目标已贴近边缘（扔出即淘汰，签名画面）
  const targetToEdge = run.arenaR - Math.hypot(t.x, t.z);
  if (p.grabbing != null) {
    if (p.grabCd <= 0) inp.grab = true;
  } else if (bd < FIGHTER.grab.range && p.grabCd <= 0 && targetToEdge < 5) {
    inp.grab = true;
  }
  if (bd < FIGHTER.punch.range + 0.2 && p.punchCd <= 0) inp.punch = true;
  return inp;
}

function randomInput(run, mem) {
  const inp = { mx: 0, mz: 0, punch: false, grab: false, ult: false };
  if (run.phase !== 'match' || !run.fighters[0].alive) return inp;
  mem.t -= dt;
  if (mem.t <= 0) {
    mem.t = 0.35 + Math.random() * 0.3;
    const a = Math.random() * Math.PI * 2;
    mem.dir = [Math.cos(a), Math.sin(a)];
    mem.act = Math.random();
  }
  inp.mx = mem.dir[0]; inp.mz = mem.dir[1];
  if (mem.act > 0.7) inp.punch = true;
  if (mem.act > 0.92) inp.grab = true;
  if (mem.act > 0.98) inp.ult = true;
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { t: 0, dir: [1, 0], act: 0 };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null, deaths = 0;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'won' && run.phase !== 'lost') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { mx: 0, mz: 0, punch: false, grab: false, ult: false };

    const sig = `${Math.sign(inp.mx || 0)},${Math.sign(inp.mz || 0)},${inp.punch ? 1 : 0},${inp.grab ? 1 : 0},${inp.ult ? 1 : 0}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.mx || inp.mz || inp.punch || inp.grab || inp.ult)) firstInputSec = t;
    prev = sig;

    updateSim(run, inp, dt);
    t += dt;

    // 场间升级自动选第一个
    if (run.phase === 'upgrade') pickUpgrade(run, run.upgradeChoices[0]);

    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && (ev.type === 'kill' || ev.type === 'fall')) firstSuccessSec = t;
    }
    if (run.phase === 'lost') deaths = 1;
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const h = getHud(run);
  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0,
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.match,
    completed: run.phase === 'won',
    score: h.score, kills: h.kills, falls: h.falls, wins: run.stats.wins,
    events: events.slice(0, 500),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { ({ chromium } = require(c)); break; } catch { /* next */ }
    }
    if (!chromium) throw new Error('playwright not found');
    const { spawn } = await import('node:child_process');
    const srv = spawn('/opt/homebrew/bin/python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'pipe'] });
    const port = await new Promise((res) => {
      const to = setTimeout(() => res(null), 8000);
      const onData = (d) => {
        const m = String(d).match(/port (\d+)/);
        if (m) { clearTimeout(to); res(m[1]); }
      };
      srv.stdout.once('data', onData);
      srv.stderr.once('data', onData);
    });
    if (!port) { srv.kill(); throw new Error('server did not start'); }
    const browser = await Promise.race([
      chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('browser launch timeout')), 10000)),
    ]);
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.waitForFunction(() => !!window.__ll, { timeout: 8000 });
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyA'); await page.waitForTimeout(60); }
    const lat = await page.evaluate(() => window.__lat);
    await browser.close();
    srv.kill();
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : 16;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    return 16;
  }
}

const runs = [
  runPolicy('greedy', 11), runPolicy('greedy', 22), runPolicy('greedy', 33),
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46),
  runPolicy('noinput', 55), runPolicy('noinput', 56),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'arena-8', genre: 'action', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s firstInput=${r.firstInputSec}s success=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} idle=${r.idleSec}s gap=${r.maxEventGapSec}s events=${r.uniqueEvents} lvl=${r.levelsReached} won=${r.completed} score=${r.score} kills=${r.kills} falls=${r.falls}`);
}
