// tools/selfplay.mjs — HAUNTED WING bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
// greedy：自动搜房找钥匙 + 实体近时躲开 + 开门逃出；random：随机移动交互；noinput：静置验证实体巡逻与心跳。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;
const cell = 2;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const norm = (x, z) => { const d = Math.hypot(x, z) || 1; return { x: x / d, z: z / d }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function spot(run, pred) { return run.map.searchables.find(pred); }
function doorCenter(run, id) {
  const d = run.map.doors.find((x) => x.id === id);
  return { x: (d.cells.reduce((s, c) => s + c.x, 0) / d.cells.length + 0.5) * cell, z: (d.cells.reduce((s, c) => s + c.z, 0) / d.cells.length + 0.5) * cell };
}
function stairSpot(run, floor) { const s = run.map.stairs[floor]; return { x: (s.x + 0.5) * cell, z: (s.z + 0.5) * cell }; }
function doorOpen(run, id) { const d = run.map.doors.find((x) => x.id === id); return d ? d.open : true; }

// greedy：直奔下一个目标；实体同层靠近时绕开
function greedyInput(run) {
  const p = run.player, e = run.entity;
  if (p.hidden) return { interact: true };
  let target;
  if (!run.keys.red) target = spot(run, (s) => s.key === 'red');
  else if (!doorOpen(run, 'red')) target = doorCenter(run, 'red');
  else if (!run.keys.blue) target = spot(run, (s) => s.key === 'blue');
  else if (!doorOpen(run, 'blue')) target = doorCenter(run, 'blue');
  else if (p.floor === 1) target = stairSpot(run, 1);
  else if (!run.keys.gold) target = spot(run, (s) => s.key === 'gold');
  else target = run.map.exit;

  const de = e.floor === p.floor ? dist(e, p) : 1e9;
  const dir = de < 7 ? norm(p.x - e.x, p.z - e.z) : norm(target.x - p.x, target.z - p.z);
  const wantYaw = Math.atan2(-dir.x, -dir.z);
  let turn = wantYaw - p.yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));

  const keySpot = spot(run, (s) => (s.key === 'red' && !run.keys.red) || (s.key === 'blue' && !run.keys.blue) || (s.key === 'gold' && !run.keys.gold));
  return {
    forward: 1,
    turn: turn * 0.6,
    interact: !!keySpot && dist(keySpot, p) < 2.0,
    sprint: true,
  };
}

// random：每 0.4s 换一次方向/手电/交互/拉杆
function randomInput(run, mem) {
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.4;
    mem.state = {
      forward: Math.random() < 0.5 ? (Math.random() < 0.5 ? 1 : -1) : 0,
      strafe: Math.random() < 0.5 ? (Math.random() < 0.5 ? 1 : -1) : 0,
      turn: (Math.random() - 0.5) * 0.6,
      sprint: Math.random() < 0.4,
      flashlight: Math.random() < 0.15,
      interact: Math.random() < 0.2,
      lever: Math.random() < 0.1 ? (1 + ((Math.random() * 3) | 0)) : 0,
    };
  }
  return { ...mem.state };
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { t: 0, state: {} };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null, deaths = 0;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase === 'playing') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = {};

    const sig = `${Math.sign(inp.forward || 0)}|${Math.sign(inp.strafe || 0)}|${!!inp.sprint}|${!!inp.interact}|${!!inp.flashlight}|${inp.lever || 0}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && sig !== '0|0|false|false|false|0') firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'key') firstSuccessSec = t;
      if (ev.type === 'caught') deaths++;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  const keysCount = Object.values(run.keys).filter(Boolean).length;
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
    levelsReached: run.phase === 'won' ? 5 : 1 + keysCount,
    completed: run.phase === 'won',
    progressRate: +clamp((1 + keysCount) / 5, 0, 1).toFixed(2),
    keys: keysCount,
    lives: run.player.lives,
    events: events.slice(0, 400),
  };
}

// 浏览器输入延迟探针（真实 keydown → 下一帧 rAF）
async function latencyProbe() {
  let browser = null;
  let srv = null;
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { ({ chromium } = require(c)); break; } catch { /* next */ }
    }
    if (!chromium) throw new Error('playwright not found');
    const { spawn } = await import('node:child_process');
    srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll);
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial?.skip?.(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(60); }
    const lat = await page.evaluate(() => window.__lat);
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : 16;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    return 16;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (srv) srv.kill();
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), `${JSON.stringify({ game: 'haunted-wing', genre: 'narrative', source: 'bot', runs }, null, 2)}\n`);
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s firstIn=${r.firstInputSec}s firstWin=${r.firstSuccessSec}s deaths=${r.deaths} keys=${r.keys} completed=${r.completed} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} uniq=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
