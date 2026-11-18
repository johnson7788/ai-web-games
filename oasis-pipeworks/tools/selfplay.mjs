// Oasis Pipeworks · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局 L1 并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { findPath, pathRequirements } from '../src/game/level.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const LEVEL_INDEX = 0; // L1

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
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
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
  const out = {
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：规划最短通路，按需放置，多余件填非通路格，用完用铲除补 ----------------
// 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const level = LEVELS[levelIndex];
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const req = pathRequirements(level);
  const reqSet = new Set(req.keys());
  const todo = new Map(req);
  const junkPlaced = [];
  const rockSet = new Set(level.rocks.map(([r, c]) => `${r},${c}`));
  const startEnd = new Set([`${level.start.r},${level.start.c}`, `${level.end.r},${level.end.c}`]);
  const cellKind = (r, c) => run.state.grid[r][c].kind;
  const key = (r, c) => `${r},${c}`;

  const emptyCells = [];
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      const k = key(r, c);
      if (!rockSet.has(k) && !startEnd.has(k) && !reqSet.has(k)) emptyCells.push({ r, c });
    }
  }

  const MAX_STEPS = 2000;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'countdown' && run.state.phase !== 'flowing') break;

    // 通路已铺满 → 开闸
    if (todo.size === 0 && run.state.phase === 'countdown') {
      tel.act(() => run.startFlow());
      break;
    }

    if (!run.state.selected) {
      const g = tel.act(() => run.grab());
      if (!g.ok) break; // locked/empty 卡死
      continue;
    }

    // 手里有件：找所需通路格
    const piece = run.state.selected;
    let target = null;
    for (const [k, need] of todo) {
      const [r, c] = k.split(',').map(Number);
      if (need === piece && (cellKind(r, c) === 'empty' || cellKind(r, c) === 'bloom')) { target = { r, c, k }; break; }
    }
    if (!target) {
      target = emptyCells.find(({ r, c }) => cellKind(r, c) === 'empty' || cellKind(r, c) === 'bloom');
      if (target) target.k = key(target.r, target.c);
    }
    if (!target && junkPlaced.length) {
      // 无空位：铲一个非通路占位管，腾出格子
      const jk = junkPlaced.shift();
      if (cellKind(jk.r, jk.c) === 'pipe' && run.state.digLeft > 0) {
        tel.act(() => run.dig(jk.r, jk.c));
        target = { r: jk.r, c: jk.c, k: jk.k };
      }
    }
    if (!target) break;

    const p = tel.act(() => run.place(target.r, target.c));
    if (!p.ok) break;
    if (todo.has(target.k)) todo.delete(target.k);
    else if (!reqSet.has(target.k)) junkPlaced.push(target);
  }

  // 开闸后流到终局（或直接流完）
  const FLOW_CAP = (level.rows + level.cols) * 2 * level.blockTime + 10;
  for (let t = 0; t < FLOW_CAP * 60 && run.state.phase === 'flowing'; t += 1) tel.tick(1 / 60);
  return finish(tel, run);
}

// ---------------- random：随机抓取/放置/铲除，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const level = LEVELS[LEVEL_INDEX];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = level.time + 10;
  while (run.state.phase === 'countdown' || run.state.phase === 'flowing') {
    if (tel.simTime >= MAX_SEC) break;
    const roll = rng();
    if (!run.state.selected) {
      tel.act(() => run.grab());
    } else if (roll < 0.7) {
      const r = Math.floor(rng() * level.rows);
      const c = Math.floor(rng() * level.cols);
      tel.act(() => run.place(r, c));
    } else if (roll < 0.85) {
      const r = Math.floor(rng() * level.rows);
      const c = Math.floor(rng() * level.cols);
      tel.act(() => run.dig(r, c));
    } else {
      tel.act(() => run.startFlow());
    }
    tel.tick(1 / 60);
  }
  // 兜底：时间到仍未开闸则自然 timeOut
  while (run.state.phase === 'countdown' && tel.simTime < level.time + 2) tel.tick(1 / 60);
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const level = LEVELS[LEVEL_INDEX];
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'countdown' || run.state.phase === 'flowing') {
    if (tel.simTime >= MAX_SEC) break;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}
const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'oasis-pipeworks',
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
