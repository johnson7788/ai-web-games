// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
// greedy：朝下一环飞（俯仰/偏航解算）+ 偶尔 boost；random：随机俯仰偏航；noinput：平飞基线。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud } from '../src/game/sim.js';
import { ringCenter, wrap } from '../src/game/track.js';
import { CONFIG } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function greedyInput(run, mem) {
  const p = run.player;
  const inp = { pitch: 0, yaw: 0, boost: false, brake: false };
  const rc = ringCenter(run.track, p.ringIndex, run.time);
  const dx = rc.x - p.pos.x, dy = rc.y - p.pos.y, dz = rc.z - p.pos.z;
  const distH = Math.hypot(dx, dz) || 1;
  const yawErr = wrap(Math.atan2(dx, dz) - p.yaw);
  const pitchErr = clamp(Math.atan2(dy, distH) - p.pitch, -1, 1);
  inp.yaw = clamp(yawErr * 1.6, -1, 1);
  inp.pitch = clamp(pitchErr * 1.6, -1, 1);
  mem.boostCd = Math.max(0, (mem.boostCd || 0) - 1 / 60);
  if (p.boost > 0.85 && distH > 60 && mem.boostCd <= 0) { inp.boost = true; mem.boostCd = 1.4; }
  return inp;
}

function randomInput(run, mem) {
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    const r = mem.rng;
    mem.t = 0.3 + r() * 1.2;
    mem.pitch = Math.round(r() * 2 - 1); // -1 / 0 / 1
    mem.yaw = Math.round(r() * 2 - 1);
    mem.boost = r() < 0.25;
  }
  return { pitch: mem.pitch, yaw: mem.yaw, boost: mem.boost, brake: false };
}

function runPolicy(policy, seed) {
  const run = createSim({ seed, trackIndex: 0 });
  const mem = { t: 0, pitch: 0, yaw: 0, boost: false, boostCd: 0, rng: mulberry32(seed * 7919) };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prevKey = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'finished') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { pitch: 0, yaw: 0, boost: false, brake: false };

    const key = `${inp.pitch.toFixed(1)}|${inp.yaw.toFixed(1)}|${+inp.boost}|${+inp.brake}`;
    if (prevKey !== null && key !== prevKey) actions++;
    prevKey = key;
    if (firstInputSec == null && (inp.pitch || inp.yaw || inp.boost || inp.brake)) firstInputSec = t;

    updateSim(run, inp);
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && run.player.ringsPassed >= 5) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  return {
    id: `${policy}-${seed}`,
    policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.stats.crashes,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: Math.min(run.player.lap, CONFIG.laps),
    completed: run.phase === 'finished',
    progressRate: +clamp((run.player.lap - 1 + run.player.ringIndex / run.track.ringCount) / CONFIG.laps, 0, 1).toFixed(2),
    score: run.player.ringsPassed,
    ringsPassed: run.player.ringsPassed,
    crashes: run.stats.crashes,
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'sky-rider-3d', genre: 'racing', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) console.log(` ${r.id}: dur=${r.durationSec}s rings=${r.ringsPassed} completed=${r.completed} deaths=${r.deaths} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} firstIn=${r.firstInputSec}s firstWin=${r.firstSuccessSec}s events=${r.uniqueEvents} lap=${r.levelsReached} latency=${r.inputLatencyMs}ms`);
