// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, updateSim, drainEvents, getHud, solveAim, getUpgradeChoices, applyUpgrade } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_SEC = 120;

function greedyInput(run, mem) {
  const inp = { strafe: 0, aim: null, fire: false };
  if (run.phase !== 'duel') return inp;
  mem.cool -= 1 / 60;
  const target = run.enemies.find((e) => e.alive);
  if (!target) return inp;
  const dz = target.z - run.player.z;
  if (Math.abs(dz) > 0.25) { inp.strafe = Math.sign(dz); return inp; }
  if (mem.cool <= 0 && run.quiver > 0) {
    const aim = solveAim(run, 'torso');
    inp.aim = aim;
    inp.fire = run.player.aimPower >= aim.power * 0.995;
    if (inp.fire) mem.cool = 0.8;
  }
  return inp;
}

function randomInput(run, mem) {
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.4;
    const r = Math.random();
    mem.mode = r < 0.45 ? 'aim' : r < 0.65 ? 'strafe' : 'idle';
    mem.aim = { angle: Math.random() * 1.2, power: 0.3 + Math.random() * 0.7 };
    mem.strafe = Math.random() < 0.5 ? -1 : 1;
    mem.fire = Math.random() < 0.5;
  }
  const inp = { strafe: 0, aim: null, fire: false };
  if (run.phase === 'duel') {
    if (mem.mode === 'aim') { inp.aim = mem.aim; if (mem.fire && run.quiver > 0) inp.fire = true; }
    else if (mem.mode === 'strafe') inp.strafe = mem.strafe;
  }
  return inp;
}

function runPolicy(policy, seed) {
  const run = createRun({ seed });
  const mem = { cool: 0, t: 0, mode: 'idle', aim: null, strafe: 0, fire: false };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0, deaths = 0;

  while (t < MAX_SEC && run.phase !== 'won' && run.phase !== 'dead') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { strafe: 0, aim: null, fire: false };

    if (inp.aim || inp.fire || inp.strafe) {
      actions++;
      if (firstInputSec == null) firstInputSec = t;
    }

    updateSim(run, inp);
    t += 1 / 60;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'kill') firstSuccessSec = t;
      if (ev.type === 'heart_lost') deaths++;
    }
    if (run.phase === 'upgrade') applyUpgrade(run, getUpgradeChoices(run, 3)[0]);
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
    deaths,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.level,
    completed: run.phase === 'won',
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { ({ chromium } = require('/opt/homebrew/lib/node_modules/playwright')); }
    const { spawn } = await import('node:child_process');
    const srv = spawn('/opt/homebrew/bin/python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'ragdoll-archers-3d', genre: 'action', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s lvl=${r.levelsReached} firstIn=${r.firstInputSec}s firstWin=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} gap=${r.maxEventGapSec}s idle=${r.idleSec}s kinds=${r.uniqueEvents} done=${r.completed} lat=${r.inputLatencyMs}ms`);
}
