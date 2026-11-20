// INK PATH · 自对弈（Node 无头，直接 import sim，无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 greedy 串行 L1→L2→L3，写出 tools/fun/autoplay.json
// （schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { solve } from '../src/game/solver.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

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

// ---------------- greedy：按求解器最优路径织网，串行 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const sol = solve(LEVELS[levelIndex]);
  if (sol) {
    for (let i = 1; i < sol.length; i += 1) {
      if (run.state.phase !== 'playing') break;
      const res = tel.act(() => run.tryMove(sol[i]));
      if (!res.ok) break;
    }
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
  }
  return last;
}

// ---------------- random：乱按后弃局，保证死亡样本存在 ----------------
function random(seed) {
  const run = createRun(7, { seed }); // L8（6 节点，需 5 步通关）
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const n = run.state.nodes.length;
  let fails = 0;
  let successes = 0;
  for (let i = 0; i < 100 && run.state.phase === 'playing'; i += 1) {
    if (successes >= 3) break; // 不可能通关，后续弃局必产生死亡
    const target = Math.floor(rng() * n);
    const res = tel.act(() => run.tryMove(target));
    if (res && res.ok) { successes += 1; fails = 0; } else { fails += 1; tel.tick(1 / 60); }
    if (fails >= 8) break;
  }
  if (run.state.phase === 'playing') tel.act(() => run.forfeit());
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/自动推进基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_TICKS = 120 * 60; // 120s sim
  for (let t = 0; t < MAX_TICKS && run.state.phase === 'playing'; t += 1) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'ink-path',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} events=${r.uniqueEvents} lvl=${r.levelsReached}`,
  );
}
