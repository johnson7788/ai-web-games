// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { MATCH, CAR } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 400;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function greedyInput(run) {
  const car = run.player;
  if (run.phase !== 'play' && run.phase !== 'overtime') return { throttle: 0, steer: 0, boost: false, jump: false };
  const b = run.ball;
  // 若车在球背向 +X 球门一侧 → 直接穿过球；否则绕到球后
  const dir = Math.sign(60 - b.x) || 1;
  const correctSide = Math.sign(b.x - car.x) === dir;
  const tx = correctSide ? b.x : b.x - dir * 4;
  const tz = b.z;
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  let d = 0;
  if (dist > 0.4) {
    const desired = Math.atan2(dz, dx);
    d = desired - car.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
  }
  const steer = clamp(d * 2.2, -1, 1);
  const aligned = Math.abs(d) < 0.35;
  let throttle = Math.abs(d) > 1.0 ? 0.3 : 1;
  const boost = aligned && dist > 2 && car.boostMeter > 0.15;
  const jump = b.y > 0.6 && dist < 8;
  return { throttle, steer, boost, jump };
}

function signature(inp) {
  return `${Math.sign(inp.steer || 0)}|${Math.sign(inp.throttle || 0)}|${!!inp.boost}|${!!inp.jump}`;
}

function runPolicy(policy, seed) {
  let t = 0, level = 1, deaths = 0;
  let run = createSim({ seed, level });
  const events = [{ t: 0, type: 'start' }];
  const kinds = new Set();
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let levelsReached = 1, completed = false;
  let prev = null, lastEventT = 0, maxGap = 0, idleSec = 0;
  let rndT = 0, rnd = { throttle: 0, steer: 0, boost: false, jump: false };
  const rndRng = mulberry32(seed * 7919 + 13);

  while (t < MAX_SEC) {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run);
    else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) {
        rndT = 0.35;
        rnd = { throttle: rndRng() < 0.6 ? (rndRng() < 0.5 ? 1 : -1) : 0, steer: rndRng() * 2 - 1, boost: rndRng() < 0.3, jump: rndRng() < 0.1 };
      }
      inp = run.phase === 'play' || run.phase === 'overtime' ? rnd : { throttle: 0, steer: 0, boost: false, jump: false };
    } else inp = {};

    const sig = signature(inp);
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.throttle || inp.steer || inp.boost || inp.jump)) firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += 1 / 60;
    levelsReached = Math.max(levelsReached, run.level);
    for (const ev of drainEvents(run)) {
      events.push({ t: +t.toFixed(2), type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'goal') firstSuccessSec = t;
    }

    if (run.phase === 'end') {
      levelsReached = Math.max(levelsReached, run.level);
      if (run.result === 'lose') {
        deaths++;
        if (policy === 'greedy') {
          run = createSim({ seed: seed + deaths * 7, level: run.level });
          prev = null;
          continue;
        }
        break;
      }
      // win
      if (run.level >= MATCH.MAX_LEVELS) { completed = true; levelsReached = MATCH.MAX_LEVELS; break; }
      run = createSim({ seed: seed + 1000 + deaths * 7, level: run.level + 1 });
      prev = null;
      continue;
    }
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
    levelsReached,
    completed,
    progressRate: +clamp(levelsReached / MATCH.MAX_LEVELS, 0, 1).toFixed(2),
    score: h.scoreP, goalsAgainst: h.scoreO, bestGoalSpeed: +run.bestGoalSpeed.toFixed(1),
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright']) {
      try { chromium = require(c).chromium; break; } catch { /* next */ }
    }
    if (!chromium) throw new Error('playwright not found');
    const { spawn } = await import('node:child_process');
    const srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll);
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(60); }
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'rocket-derby', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s goals=${r.score}-${r.goalsAgainst} lvl=${r.levelsReached} completed=${r.completed} deaths=${r.deaths} firstInput=${r.firstInputSec}s firstGoal=${r.firstSuccessSec}s gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} events=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
