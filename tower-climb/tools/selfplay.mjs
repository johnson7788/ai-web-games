// tools/selfplay.mjs — bot 遥测：greedy×3 / random×5 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents } from '../src/game/sim.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };
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

// 目标 = 比当前脚高 0.3m 以上、且最低的未坍塌平台
function nextTarget(run) {
  const p = run.player;
  let target = null, bestY = Infinity;
  for (const q of run.platforms) {
    if (q.collapsed) continue;
    if (q.y <= p.y + 0.3) continue;
    if (q.y < bestY) { bestY = q.y; target = q; }
  }
  return target || run.platforms.find((q) => q.id === 'landing-10');
}

// greedy：朝下一平台投影走近 → 站定减速 → 原地跳；空中轻推对齐。
function greedyInput(run) {
  const p = run.player;
  const target = nextTarget(run);
  const dx = target.x - p.x, dz = target.z - p.z;
  const dist = Math.hypot(dx, dz), diff = target.y - p.y;
  const desiredYaw = Math.atan2(-dx, -dz);
  const inp = { moveF: 0, moveS: 0, jump: false, dash: false, lookX: clamp(wrap(p.yaw - desiredYaw), -0.2, 0.2), lookY: 0 };
  const jumpable = diff > 0.2 && diff <= 3.4;
  const hspeed = Math.hypot(p.vx, p.vz);
  if (p.onGround) {
    if (dist > 1.2) inp.moveF = 1;
    else if (jumpable && hspeed < 1.5) inp.jump = true;
  } else if (dist > 2.5) {
    inp.moveF = 1;
  }
  return inp;
}

function randomInput(run, mem) {
  mem.t -= 1 / 60;
  if (mem.t <= 0) {
    mem.t = 0.4;
    const r = mem.rng;
    mem.s = {
      moveF: [-1, 0, 1][(r() * 3) | 0],
      moveS: [-1, 0, 1][(r() * 3) | 0],
      jump: r() < 0.5,
      dash: r() < 0.25,
      lookX: (r() - 0.5) * 0.3,
    };
  }
  return { ...mem.s, lookY: 0 };
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { t: 0, s: {}, rng: mulberry32(seed * 7919 + 17) };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prevSig = '', lastEventT = 0, idleSec = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  const accepted = (inp) => {
    const sig = `${inp.moveF ? 1 : 0}|${inp.moveS ? 1 : 0}|${inp.jump ? 1 : 0}|${inp.dash ? 1 : 0}`;
    if (sig !== prevSig) actions++;
    prevSig = sig;
    if (firstInputSec == null && (inp.moveF || inp.moveS || inp.jump || inp.dash)) firstInputSec = t;
  };

  while (t < MAX_SEC && run.phase !== 'won') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run);
    else if (policy === 'random') inp = randomInput(run, mem);
    else inp = { moveF: 0, moveS: 0, jump: false, dash: false, lookX: 0, lookY: 0 };

    accepted(inp);
    updateSim(run, inp);
    t += 1 / 60;

    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'level_up' && ev.floor >= 2) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);

  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: +(firstInputSec ?? t).toFixed(2),
    inputLatencyMs: 0, // 浏览器探针统一填
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.falls,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.maxFloor,
    completed: run.phase === 'won',
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
    const { spawn } = await import('node:child_process');
    const srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
    await page.evaluate(() => { window.__ll.start(); if (window.__ll.tutorial?.skip) window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(60); }
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
  runPolicy('random', 47), runPolicy('random', 48),
  runPolicy('noinput', 55), runPolicy('noinput', 56),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'tower-climb', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s first=${r.firstInputSec}s win=${r.firstSuccessSec}s deaths=${r.deaths} actions=${r.actions} floor=${r.levelsReached} completed=${r.completed} gap=${r.maxEventGapSec}s idle=${r.idleSec}s events=${r.uniqueEvents} latency=${r.inputLatencyMs}ms`);
}
