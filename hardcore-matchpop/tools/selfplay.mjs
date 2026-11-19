// HARDCORE MATCHPOP · 自对弈（Node 无头，直接 import sim，无 DOM）
// 固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json
// （schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const N = GAME.N;
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// 找最大同色连通块（BFS）
function findLargest(grid) {
  const seen = new Set();
  let best = null;
  let bestLen = 0;
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (grid[r][c] < 0 || seen.has(`${r},${c}`)) continue;
      const color = grid[r][c];
      const local = new Set([`${r},${c}`]);
      const stack = [[r, c]];
      let n = 0;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        n += 1;
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
          if (grid[nr][nc] !== color) continue;
          const k = `${nr},${nc}`;
          if (local.has(k)) continue;
          local.add(k);
          stack.push([nr, nc]);
        }
      }
      for (const k of local) seen.add(k);
      if (n > bestLen) { bestLen = n; best = { r, c, size: n }; }
    }
  }
  return best;
}

function newTel(policy, seed, level) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
  };
}

function tick(tel, run, dt) {
  run.step(dt);
  tel.simTime += dt;
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
}

function act(tel, run, fn) {
  const res = fn();
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
  }
  return res;
}

function finish(tel, run, levelsReached) {
  const times = [...tel.eventTimes].sort((a, b) => a - b);
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
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：每手点最大连通块，串行打 L1→L2→L3（推进率要求到第 3 关） ----------------
function greedy(seed) {
  const tel = newTel('greedy', seed, 1);
  let levelsReached = 1;
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    lastRun = run;
    const level = LEVELS[lv];
    tel.level = lv + 1;
    let guard = 0;
    while (run.state.phase === 'playing' && guard++ < 6000) {
      const best = findLargest(run.state.grid);
      if (!best) { tick(tel, run, 1 / 60); continue; }
      act(tel, run, () => run.tap(best.r, best.c));
      tick(tel, run, 1 / 60);
    }
    // 兜底：若还因某种原因在倒计时内，推进到自然结束
    while (run.state.phase === 'playing' && tel.simTime < level.time * (lv + 1) + 2) tick(tel, run, 1 / 60);
    if (run.state.phase === 'won') levelsReached = lv + 2; // 已开始下一关（1 基）
    else break;
  }
  return finish(tel, lastRun, levelsReached);
}

// ---------------- random：随机乱按/洗牌/炸弹，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = newTel('random', seed, 1);
  const rng = mulberry32(seed * 7919 + 13);
  const maxSec = GAME.TIME + 2;
  let guard = 0;
  while (run.state.phase === 'playing' && tel.simTime < maxSec && guard++ < 40000) {
    const roll = rng();
    if (roll < 0.72) act(tel, run, () => run.tap(Math.floor(rng() * N), Math.floor(rng() * N)));
    else if (roll < 0.9) act(tel, run, () => run.shuffle());
    else act(tel, run, () => run.bomb(Math.floor(rng() * N), Math.floor(rng() * N)));
    tick(tel, run, 1 / 60);
  }
  return finish(tel, run, 1);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = newTel('noinput', seed, 1);
  const maxSec = GAME.TIME + 2;
  while (run.state.phase === 'playing' && tel.simTime < maxSec) tick(tel, run, 1 / 60);
  return finish(tel, run, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'hardcore-matchpop',
  genre: 'puzzle',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed}`,
  );
}
