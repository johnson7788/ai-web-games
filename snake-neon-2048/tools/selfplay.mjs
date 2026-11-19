// SNAKE NEON 2048 · 自对弈（无头，直接 import sim）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function key(x, y) { return `${x},${y}`; }
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function bodyBlocked(state, includeTail) {
  const arr = includeTail ? state.snake : state.snake.slice(0, -1);
  const set = new Set();
  for (const s of arr) set.add(key(s.x, s.y));
  return set;
}
function isSafe(state, x, y, includeTail) {
  if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return false;
  if (state.grid[y][x].type === 1) return false;
  if (bodyBlocked(state, includeTail).has(key(x, y))) return false;
  return true;
}

function floodFill(state, sx, sy) {
  const blocked = bodyBlocked(state, false);
  const seen = new Set([key(sx, sy)]);
  const q = [[sx, sy]];
  let count = 0;
  while (q.length) {
    const [x, y] = q.shift();
    count += 1;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue;
      if (seen.has(k) || blocked.has(k)) continue;
      if (state.grid[ny][nx].type === 1) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return count;
}

function bfsStep(state, target) {
  if (!target) return null;
  const head = state.snake[0];
  const blocked = bodyBlocked(state, false);
  const seen = new Set([key(head.x, head.y)]);
  const q = [{ x: head.x, y: head.y, path: [] }];
  while (q.length) {
    const cur = q.shift();
    if (cur.x === target.x && cur.y === target.y) return cur.path[0] || null;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue;
      if (seen.has(k) || blocked.has(k)) continue;
      if (state.grid[ny][nx].type === 1) continue;
      seen.add(k);
      q.push({ x: nx, y: ny, path: [...cur.path, { dx, dy }] });
    }
  }
  return null;
}

function survivalStep(state) {
  const head = state.snake[0];
  const rev = { x: -state.dir.x, y: -state.dir.y };
  let best = null;
  let bestScore = -1;
  for (const [dx, dy] of DIRS) {
    if (dx === rev.x && dy === rev.y) continue;
    if (!isSafe(state, head.x + dx, head.y + dy, false)) continue;
    const score = floodFill(state, head.x + dx, head.y + dy);
    if (score > bestScore) { bestScore = score; best = { dx, dy }; }
  }
  return best;
}

function decide(state) {
  const target = state.golden || state.fruit;
  return bfsStep(state, target) || survivalStep(state);
}

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    maxLevel: (carried && carried.maxLevel) ?? 1,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'eat' || e.type === 'golden') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'die') this.deaths += 1;
        if (e.type === 'win') this.maxLevel = Math.max(this.maxLevel, run.state.level);
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(1 / 60);
      }
      return res;
    },
  };
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.maxLevel,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.maxLevel,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：BFS 追核心，串行打 L1→L2→L3 ----------------
function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { result, tel } = greedyOnce(lv, seed + lv * 7, carried);
    last = result;
    carried = tel;
    if (!result.completed) break;
  }
  return last;
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const CAP = 120;
  while (run.state.phase === 'idle' || run.state.phase === 'running') {
    if (tel.simTime >= CAP) break;
    const step = decide(run.state);
    if (step) {
      const res = run.setDir(step.dx, step.dy);
      if (res && res.ok) {
        tel.actions += 1;
        if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
      }
    }
    tel.tick(1 / 60);
  }
  return { result: finish(tel, run), tel };
}

// ---------------- random：随机转向，验证输入鲁棒性 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const CAP = 30;
  while (run.state.phase === 'idle' || run.state.phase === 'running') {
    if (tel.simTime >= CAP) break;
    const d = DIRS[Math.floor(rng() * 4)];
    const res = run.setDir(d[0], d[1]);
    if (res && res.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动起步/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const CAP = 30;
  while (run.state.phase === 'idle' || run.state.phase === 'running') {
    if (tel.simTime >= CAP) break;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'snake-neon-2048',
  genre: 'arcade',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} level=${r.levelsReached} completed=${r.completed}`,
  );
}
