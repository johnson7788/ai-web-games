// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, gateCenterY } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 240;

function nextGate(run) {
  let best = null;
  for (const g of run.obstacles) {
    if (g.passed) continue;
    if (g.x >= run.dist - 0.5) {
      if (!best || g.x < best.x) best = g;
    }
  }
  return best;
}

function greedyInput(run, mem) {
  const g = nextGate(run);
  if (!g) return false;
  const center = gateCenterY(g, run.time);
  const dy = center - run.y;
  const dead = 0.35;
  if (dy > dead) return true;
  if (dy < -dead) return false;
  // 悬停微调：接近中心时按垂直速度补偿（这正是单键穿缝的手感）
  if (run.vy > 0.9) return false;
  if (run.vy < -0.9) return true;
  return mem.lastHold;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { lastHold: false, rndT: 0, rndHold: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase === 'playing') {
    let hold = false;
    if (policy === 'greedy') {
      hold = greedyInput(run, mem);
    } else if (policy === 'random') {
      mem.rndT -= 1 / 60;
      if (mem.rndT <= 0) { mem.rndT = 0.2 + Math.random() * 0.4; mem.rndHold = Math.random() < 0.5; }
      hold = mem.rndHold;
    } else {
      hold = false; // noinput：自由落体基线
    }
    mem.lastHold = hold;

    const sig = hold ? '1' : '0';
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && hold) firstInputSec = t;
    prev = sig;

    updateSim(run, { hold });
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t: +t.toFixed(2), type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && (ev.type === 'perfect' || ev.type === 'orb')) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.phase === 'dead' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.stats.maxLevel,
    completed: run.phase === 'finished',
    progressRate: +Math.min(1, run.dist / 2500).toFixed(2),
    score: Math.round(run.score),
    topMult: run.stats.topMult,
    perfects: run.stats.perfects,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
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
    for (let i = 0; i < 12; i++) { await page.keyboard.down('Space'); await page.keyboard.up('Space'); await page.waitForTimeout(60); }
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

const out = {
  game: 'space-wave-3d',
  genre: 'arcade',
  source: 'bot',
  version: 1,
  seedPolicy: 'mulberry32',
  runs,
};
fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} mult×${r.topMult} perfect=${r.perfects} lvl=${r.levelsReached} completed=${r.completed} deaths=${r.deaths} actions=${r.actions} firstIn=${r.firstInputSec}s firstOk=${r.firstSuccessSec}s gap=${r.maxEventGapSec}s idle=${r.idleSec}s events=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
