// Tile Vault · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 L1→L2→L3 并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { mulberry32 } from '../src/game/level.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const LEVEL_INDEX = 0;

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
      }
      this.tick(1 / 60);
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
    inputLatencyMs: 0,
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

// greedy：按求解器给的最优顺序逐层清空，串行打 L1→L2→L3
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const order = run._solution || [];
  for (const id of order) {
    if (run.state.phase !== 'playing') break;
    tel.act(() => run.pick(id));
  }
  // 兜底：若仍未结束，推进到计时器自然结束
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 60 * 200) tel.tick(1 / 60);
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const level = LEVELS[LEVEL_INDEX];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'playing') {
    if (tel.simTime >= MAX_SEC) break;
    const free = run.state.tiles.filter((t) => run.isFree(t));
    if (free.length) {
      const t = free[Math.floor(rng() * free.length)];
      tel.act(() => run.pick(t.id));
    } else {
      tel.tick(1 / 60);
    }
  }
  while (run.state.phase === 'playing' && tel.simTime < level.time + 2) tel.tick(1 / 60);
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const level = LEVELS[LEVEL_INDEX];
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'playing') {
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

const runs = [greedy(3), random(5), noinput(3)];
const payload = {
  game: 'tile-vault',
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
