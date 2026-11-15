// tools/selfplay.mjs — bot 遥测：greedy×3 / random×4 / noinput×1，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { CARS, RAMPS } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;
const AIRROLL = CARS[0].airRoll;
const TWO_PI = Math.PI * 2;

function nearestRampAhead(run) {
  const p = run.player;
  for (const r of RAMPS) if (p.z < r.z && r.z - p.z < 30) return r;
  return null;
}

function nearestCoin(run) {
  const p = run.player;
  let best = null, bd = 1e9;
  for (const c of run.track.coins) {
    if (c.taken) continue;
    const dz = c.z - p.z;
    if (dz < -2 || dz > 60) continue;
    const d = Math.abs(dz) + Math.abs(c.x - p.x) * 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function greedyInput(run, mem) {
  const p = run.player;
  const inp = { throttle: 1, steer: 0, flip: 0, yaw: 0, nitro: false };
  if (p.airborne) {
    if (!mem.done) {
      inp.flip = 1;
      mem.acc += AIRROLL / 60;
      if (mem.acc >= TWO_PI) { inp.flip = 0; mem.done = true; }
    }
  } else {
    mem.done = false; mem.acc = 0;
    const ramp = nearestRampAhead(run);
    if (ramp) inp.steer = clamp((0 - p.x) * 0.6, -1, 1);
    else {
      const coin = nearestCoin(run);
      if (coin) inp.steer = clamp((coin.x - p.x) * 0.8, -1, 1);
      else inp.steer = clamp((0 - p.x) * 0.5, -1, 1);
    }
    if (run.nitro >= 1 && run.boostT <= 0) inp.nitro = true;
  }
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed, car: 0 });
  const mem = { done: false, acc: 0 };
  let rndT = 0;
  const rnd = { throttle: 1, steer: 0, flip: 0, yaw: 0, dir: 1, dur: 0, t: 0, started: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') {
      inp = greedyInput(run, mem);
    } else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) {
        rndT = 0.4;
        rnd.throttle = Math.random() < 0.72 ? 1 : 0;
        rnd.steer = Math.random() * 2 - 1;
      }
      const p = run.player;
      // 空中随机翻转：起跳即锁一个方向 + 随机时长（部分翻转），落地多侧翻/翻车
      if (p.airborne) {
        if (!rnd.started) { rnd.started = true; rnd.dir = Math.random() < 0.5 ? -1 : 1; rnd.dur = 0.35 + Math.random() * 0.5; rnd.t = 0; }
        if (rnd.t < rnd.dur) { rnd.flip = rnd.dir; rnd.t += 1 / 60; }
        else rnd.flip = 0;
      } else { rnd.started = false; rnd.flip = 0; }
      inp = {
        throttle: rnd.throttle,
        steer: rnd.steer,
        flip: p.airborne ? rnd.flip : 0,
        yaw: 0,
        nitro: Math.random() < 0.08,
      };
    } else {
      inp = {};
    }

    const sig = `${Math.sign(inp.throttle || 0)}|${Math.sign(inp.steer || 0)}|${Math.sign(inp.flip || 0)}|${Math.sign(inp.yaw || 0)}|${!!inp.nitro}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.throttle || inp.steer || inp.flip || inp.yaw || inp.nitro)) firstInputSec = t;
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
      if (firstSuccessSec == null && (ev.type === 'perfect' || ev.type === 'zone' || ev.type === 'coin')) firstSuccessSec = t;
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
    deaths: run.deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: Math.max(1, run.zoneReached),
    completed: run.phase === 'finished',
    progressRate: +clamp(run.player.z / run.track.finishZ, 0, 1).toFixed(2),
    score: h.score, topCombo: run.stats.topCombo, flips: run.stats.flips, wrecks: run.stats.wrecks,
    events: events.slice(0, 400),
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
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
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
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46), runPolicy('random', 47),
  runPolicy('noinput', 55),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'city-stunt-drive', genre: 'arcade', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} combo×${r.topCombo} flips=${r.flips} deaths=${r.deaths} completed=${r.completed} zone=${r.levelsReached} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} firstSuccess=${r.firstSuccessSec}s latency=${r.inputLatencyMs}ms`);
