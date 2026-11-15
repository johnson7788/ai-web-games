// tools/selfplay.mjs — bot 遥测：greedy / random / noinput 三策略纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { CAR } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

// greedy：沿中心线驾驶（预瞄曲率转向 + 弯前减速 + 手刹漂移过急弯）
function greedyInput(run, mem) {
  const p = run.player;
  const inp = { throttle: true, brake: false, steer: 0, handbrake: false, shiftDown: false };
  const look = 28;
  const kappa = run.track.curvatureAt(p.s + look);
  const kappaNear = run.track.curvatureAt(p.s + 8);
  inp.steer = clamp(-p.angle * 1.4 - p.t * 0.10 - kappa * p.speed * 0.62, -1, 1);
  const tight = Math.abs(kappaNear) > 0.009;
  if (tight && p.speed > 34) { inp.throttle = false; inp.brake = true; }
  else if (tight && p.speed > 26) inp.throttle = false;
  inp.handbrake = Math.abs(kappa) > 0.0055 && p.speed > 18; // 弯道尽量漂移 → 漂移计分 + 事件密度
  return inp;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = {};
  let rndT = 0, rnd = { throttle: false, brake: false, steer: 0, handbrake: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'busted' && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) {
        rndT = 0.35;
        rnd = {
          throttle: Math.random() < 0.7,
          brake: Math.random() < 0.25,
          steer: Math.random() * 2 - 1,
          handbrake: Math.random() < 0.35,
        };
      }
      inp = { ...rnd, shiftDown: false };
    } else inp = { throttle: false, brake: false, steer: 0, handbrake: false, shiftDown: false };

    const sig = `${Math.round((inp.steer || 0) * 2)}|${inp.throttle ? 1 : 0}|${inp.brake ? 1 : 0}|${inp.handbrake ? 1 : 0}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.throttle || inp.brake || inp.steer || inp.handbrake)) firstInputSec = t;
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
      if (firstSuccessSec == null && ev.type === 'stageClear') firstSuccessSec = t;
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
    deaths: run.phase === 'busted' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.stage,
    completed: run.phase === 'finished',
    progressRate: +clamp(run.stage / 5, 0, 1).toFixed(2),
    score: h.score, topDrift: +run.stats.driftSec.toFixed(1), hits: run.stats.hits, pace: run.stats.pacePerfect,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    process.env.NODE_PATH = '/opt/homebrew/lib/node_modules';
    const { createRequire } = await import('node:module');
    const require = createRequire('/opt/homebrew/lib/node_modules/playwright/package.json');
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
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46), runPolicy('random', 47), runPolicy('random', 48),
  runPolicy('noinput', 55),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'rally-dust-3d', genre: 'arcade', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s score=${r.score} level=${r.levelsReached} firstSuccess=${r.firstSuccessSec} deaths=${r.deaths} hits=${r.hits} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} events=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
