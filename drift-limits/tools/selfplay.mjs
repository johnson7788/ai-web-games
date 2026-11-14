// tools/selfplay.mjs — bot 遥测：greedy×3 / random / noinput，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

function greedyInput(run, mem) {
  const p = run.player;
  const inp = { steer: 0, drift: false, nitro: false, brake: false, launch: false };
  if (run.phase === 'lights') return inp;
  if (!mem.launched && run.time < 0.1) { inp.launch = true; mem.launched = true; return inp; }
  const kappa = run.track.curvatureAt(p.s + 25);
  const threat = run.traffic.find((c) => c.s - p.s > 0 && c.s - p.s < 90 && Math.abs(c.t - p.t) < 2.4);
  const blocked = (l) => run.traffic.some((c) => c.s - p.s > -5 && c.s - p.s < 110 && Math.abs(c.t - l) < 2.4);
  if (mem.target == null || blocked(mem.target) || (!threat && Math.abs(p.t - mem.target) < 0.5)) {
    const lanes = [-5, 0, 5];
    const free = lanes.filter((l) => !blocked(l));
    mem.target = (free.length ? free : lanes).sort((a, b) => Math.abs(a - p.t) - Math.abs(b - p.t))[0];
  }
  const target = mem.target;
  inp.steer = clamp((target - p.t) * 0.35 - p.angle * 1.2, -1, 1);
  const gap = run.cops.length ? p.s - Math.min(...run.cops.map((c) => c.s)) : 99;
  const carNear = run.traffic.some((c) => c.s - p.s > -5 && c.s - p.s < 60);
  inp.drift = !carNear && Math.abs(p.t) < 4 && gap > 25 && ((Math.abs(kappa) > 0.0035 && p.speed > 32) || (run.nitro < 0.25 && gap > 35 && Math.abs(kappa) > 0.0015));
  inp.nitro = run.nitro >= 1 && (gap < 35 || Math.abs(kappa) < 0.001);
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { launched: false };
  let rndT = 0, rnd = { steer: 0, drift: false, nitro: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;
  const L = run.track.length;

  while (t < MAX_SEC && run.phase !== 'busted' && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) { rndT = 0.4; rnd = { steer: Math.random() * 2 - 1, drift: Math.random() < 0.5, nitro: Math.random() < 0.2 }; }
      inp = { ...rnd, launch: run.phase === 'race' && run.time < 0.1 && !mem.launched };
      if (inp.launch) mem.launched = true;
    } else inp = {};
    // 有效操作计数
    const sig = `${Math.sign(inp.steer || 0)}|${!!inp.drift}|${!!inp.nitro}|${!!inp.launch}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.steer || inp.drift || inp.nitro || inp.launch)) firstInputSec = t;
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
      if (firstSuccessSec == null && (ev.type === 'nearMiss' || ev.type === 'lap')) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const h = getHud(run);
  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.phase === 'busted' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.heat,
    completed: run.phase === 'finished',
    progressRate: +clamp(run.player.s / (3 * L), 0, 1).toFixed(2),
    score: h.score, topMult: run.stats.topMult, nearMisses: run.stats.nearMisses, crashes: run.stats.crashes,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright');
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} mult×${r.topMult} near=${r.nearMisses} crash=${r.crashes} completed=${r.completed} deaths=${r.deaths} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} latency=${r.inputLatencyMs}ms`);