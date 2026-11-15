// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// greedy：沿 BFS 最短路径朝出口移动 + 实体逼近时躲桌底/逃离；random：乱走；noinput：静置（验证荧光灯与实体漫游）。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, updateSim, drainEvents, getHud, mulberry32 } from '../src/game/sim.js';
import { WORLD, PLAYER, ENTITY } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const MAX_SEC = 240;
const C = WORLD.CELL;

function cellOf(x, z) { return { i: Math.floor(x / C), j: Math.floor(z / C) }; }

function bfs(run, start, goal) {
  const W = WORLD.GRID_W, H = WORLD.GRID_H;
  const { openE, openS } = run.maze;
  const key = (i, j) => j * W + i;
  const prev = new Map();
  const seen = new Set([key(start.i, start.j)]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    if (c.i === goal.i && c.j === goal.j) {
      const out = [];
      let k = key(c.i, c.j);
      while (k != null) { out.unshift({ i: k % W, j: Math.floor(k / W) }); k = prev.get(k); }
      return out;
    }
    const neigh = [];
    if (c.i + 1 < W && openE[c.j][c.i]) neigh.push({ i: c.i + 1, j: c.j });
    if (c.i - 1 >= 0 && openE[c.j][c.i - 1]) neigh.push({ i: c.i - 1, j: c.j });
    if (c.j + 1 < H && openS[c.j][c.i]) neigh.push({ i: c.i, j: c.j + 1 });
    if (c.j - 1 >= 0 && openS[c.j - 1][c.i]) neigh.push({ i: c.i, j: c.j - 1 });
    for (const n of neigh) {
      const k = key(n.i, n.j);
      if (!seen.has(k)) { seen.add(k); prev.set(k, key(c.i, c.j)); q.push(n); }
    }
  }
  return [start];
}

function steerToward(run, dx, dz, opts = {}) {
  const p = run.player;
  const d = Math.hypot(dx, dz) || 1;
  const desYaw = Math.atan2(-dx, -dz);
  const diff = wrap(desYaw - p.yaw);
  const lookDX = clamp(diff, -0.15, 0.15);
  const newYaw = p.yaw + lookDX;
  const fx = -Math.sin(newYaw), fz = -Math.cos(newYaw);
  const rx = Math.cos(newYaw), rz = -Math.sin(newYaw);
  const moveX = clamp((dx * rx + dz * rz) / d, -1, 1);
  const moveZ = clamp((dx * fx + dz * fz) / d, 0, 1); // 绝不后退：目标在身后时先原地转身
  const minStam = opts.minStam ?? 25;
  const sprint = d > 2 && p.stamina > minStam && p.pantT <= 0;
  return { moveX, moveZ, sprint, hide: false, lookDX, lookDY: 0 };
}

function nearestTable(run) {
  const p = run.player;
  let best = null, bd = Infinity;
  for (const t of run.maze.tables) {
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function greedyInput(run, mem) {
  const p = run.player;
  const e = run.entity;
  const distE = Math.hypot(e.x - p.x, e.z - p.z);
  const chasing = e.state === 'chase';

  // 实体逼近：躲桌底，否则逃离
  if (chasing && distE < 12) {
    const t = nearestTable(run);
    if (t && Math.hypot(t.x - p.x, t.z - p.z) < PLAYER.reachTable * 0.9) {
      if (!p.hidden) return { moveX: 0, moveZ: 0, sprint: false, hide: true, lookDX: 0, lookDY: 0 };
      return { moveX: 0, moveZ: 0, sprint: false, hide: false, lookDX: 0, lookDY: 0 };
    }
    // 逃跑：跑能甩开实体（7.6 vs 4.8），保留一点体力兜底
    return steerToward(run, -(e.x - p.x), -(e.z - p.z), { minStam: 12 });
  }

  // 朝当前出口（BFS 最短路）；实体在附近时静步（不跑，避免引它）
  const stealth = distE < 20;
  const pc = cellOf(p.x, p.z);
  const ec = cellOf(run.activeExit.x, run.activeExit.z);
  if (pc.i === ec.i && pc.j === ec.j) {
    return steerToward(run, run.activeExit.x - p.x, run.activeExit.z - p.z, { minStam: stealth ? Infinity : 25 });
  }
  const path = bfs(run, pc, ec);
  const next = path[1] || path[0];
  const wx = (next.i + 0.5) * C, wz = (next.j + 0.5) * C;
  return steerToward(run, wx - p.x, wz - p.z, { minStam: stealth ? Infinity : 25 });
}

function runPolicy(policy, seed) {
  const run = createRun({ seed });
  const rr = mulberry32(seed * 1000 + 1); // random 策略输入也走 seed，重跑可比
  const mem = {};
  let rndT = 0;
  let rnd = { moveX: 0, moveZ: 0, sprint: false };
  const events = [];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  // start 事件作为首条（sim 已内置 start，drain 后加入 kinds）
  const first = drainEvents(run);
  for (const ev of first) { events.push({ t: 0, type: ev.type }); kinds.add(ev.type); }

  while (t < MAX_SEC && run.phase !== 'won') {
    let inp;
    if (policy === 'greedy') inp = greedyInput(run, mem);
    else if (policy === 'random') {
      rndT -= 1 / 60;
      if (rndT <= 0) {
        rndT = 0.5;
        rnd = {
          moveX: rr() * 2 - 1, moveZ: rr() * 2 - 1,
          sprint: rr() < 0.35, hide: rr() < 0.15,
        };
      }
      inp = { ...rnd, lookDX: (rr() - 0.5) * 0.2, lookDY: 0 };
    } else inp = { moveX: 0, moveZ: 0, sprint: false, hide: false, lookDX: 0, lookDY: 0 };

    // 有效操作计数（输入签名变化）
    const sig = `${inp.moveX.toFixed(1)}|${inp.moveZ.toFixed(1)}|${!!inp.sprint}|${!!inp.hide}`;
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (Math.abs(inp.moveX) > 0.01 || Math.abs(inp.moveZ) > 0.01 || inp.sprint || inp.hide)) firstInputSec = t;
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
      if (firstSuccessSec == null && ev.type === 'exit_found') firstSuccessSec = t;
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
    deaths: run.caught,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.segment,
    completed: run.phase === 'won',
    score: Math.round(run.time), exitsFound: run.exitIndex, caught: run.caught,
    events: events.slice(0, 400),
  };
}

async function latencyProbe() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let chromium;
    for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
      try { chromium = require(c).chromium; break; } catch { /* next */ }
    }
    if (!chromium) throw new Error('playwright not found');
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
    for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyD'); await page.waitForTimeout(60); }
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
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'backroom-9', genre: 'narrative', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) console.log(` ${r.id}: dur=${r.durationSec}s exits=${r.exitsFound} seg=${r.levelsReached} caught=${r.caught} completed=${r.completed} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} events=${r.uniqueEvents} firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec}s`);
