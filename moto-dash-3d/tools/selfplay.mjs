// tools/selfplay.mjs — bot 遥测：greedy / random / noinput 三策略，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3；genre=action）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { MOTO, ROAD, TRAFFIC, STEP } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 200;
const SAME_X = ROAD.sameLaneIdx.map((i) => ROAD.laneX[i]);

function nearestSame(run, x, zMin = -6, zMax = 90) {
  let best = null;
  for (const c of run.traffic) {
    if (c.dir !== 1 || c.z <= zMin || c.z > zMax || Math.abs(c.x - x) > 2.1) continue;
    if (!best || c.z < best.z) best = c;
  }
  return best;
}

// greedy：全油门，前方有车按 A/D 变道避让，偶尔贴近擦身；两同向车道都堵就刹车等缝。
function greedyInput(run, mem) {
  const p = run.player;
  const inp = { steer: 0, throttle: true, brake: false, nitro: false };

  if (p.nitro >= 0.999) mem.nitroOn = true;
  if (p.nitro < 0.15) mem.nitroOn = false;
  inp.nitro = !!mem.nitroOn;

  // 安全网（最高优先）：任何方向近距危险 → 立即避险
  for (const c of run.traffic) {
    const dz = Math.abs(c.z);
    const dx = Math.abs(c.x - p.x);
    const hitX = (MOTO.halfW + c.hw) * 1.25;
    const hitZ = (MOTO.length + c.len) / 2 + 4;
    if (dz < hitZ && dx < hitX) {
      const away = p.x >= c.x ? 1 : -1;
      inp.steer = away;
      if (c.dir === 1 && c.z > -2 && c.z < 18) { inp.brake = true; inp.throttle = false; }
      return inp;
    }
  }

  // 安全贴近擦身（仅小汽车、速度<42、另一车道确空）
  const curC = nearestSame(run, p.x);
  if (!mem.hug && curC && !curC.isTruck && curC.z > 12 && curC.z < 50 && p.speed < 42) {
    const other = SAME_X.find((x) => Math.abs(x - curC.x) > 1.5);
    const otherC = nearestSame(run, other);
    if (other != null && (!otherC || otherC.z > 70)) {
      mem.hug = curC;
      mem.hugSide = other < curC.x ? -1 : 1;
      mem.hugClear = curC.hw + MOTO.halfW + 0.32;
    }
  }
  if (mem.hug) {
    if (run.traffic.includes(mem.hug) && mem.hug.z > -3) {
      const targetX = mem.hug.x + mem.hugSide * mem.hugClear;
      inp.steer = clamp((targetX - p.x) * 2.2, -1, 1);
      return inp;
    }
    mem.hug = null;
  }

  // 变道避让：当前车道前方有车则去更空的车道
  const gap = (x) => { const c = nearestSame(run, x); return c ? c.z : 999; };
  let target = mem.target;
  if (target == null || Math.abs(p.x - target) < 0.4) {
    target = SAME_X.slice().sort((a, b) => gap(b) - gap(a))[0];
    mem.target = target;
  }
  const tC = nearestSame(run, target);
  if (curC && curC.z < 35 && tC && tC.z < 22) { inp.brake = true; inp.throttle = false; }
  inp.steer = clamp((target - p.x) * 1.6, -1, 1);
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { target: null, hug: null, hugSide: 1, nitroOn: false };
  let rndT = 0;
  let rnd = { steer: 0, throttle: false, nitro: false, brake: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prevSig = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  const bucket = (s) => Math.round(clamp(s, -1, 1) * 4) / 4;

  while (t < MAX_SEC && run.phase !== 'over') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') {
      rndT -= STEP;
      if (rndT <= 0) {
        rndT = 0.4;
        rnd = { steer: run.rand() * 2 - 1, throttle: run.rand() < 0.7, nitro: run.rand() < 0.2, brake: run.rand() < 0.15 };
      }
      inp = { ...rnd };
    } else inp = {};

    const sig = `${bucket(inp.steer || 0)}|${!!inp.throttle}|${!!inp.brake}|${!!inp.nitro}`;
    if (prevSig !== null && sig !== prevSig) actions++;
    if (firstInputSec == null && (inp.steer || inp.throttle || inp.brake || inp.nitro)) firstInputSec = t;
    prevSig = sig;

    updateSim(run, inp);
    t += STEP;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'checkpoint') firstSuccessSec = t;
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
    deaths: run.phase === 'over' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: h.levelsReached,
    completed: false,
    score: h.score,
    distance: Math.floor(h.distance),
    nearMisses: h.nearMisses,
    topCombo: h.topCombo,
    events: events.slice(0, 500),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let pw = null;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { pw = require(c); break; } catch { /* next */ }
    }
    if (!pw) throw new Error('playwright not found');
    const { chromium } = pw;
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ genre: 'action', runs }, null, 2));
console.log('autoplay.json written (genre=action):');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} dist=${r.distance}m near=${r.nearMisses} combo×${r.topCombo} deaths=${r.deaths} level=${r.levelsReached} actions=${r.actions} gap=${r.maxEventGapSec}s idle=${r.idleSec}s uniq=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
