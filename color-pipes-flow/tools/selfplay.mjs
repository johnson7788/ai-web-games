// COLOR PIPES FLOW · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成通关并把遥测写进 tools/fun/autoplay.json（schema 见 references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
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
    _tel: tel,
  };
}

// ---------------- greedy：按正解逐关打 L1→L2→L3（推进率门槛要求到第 3 关） ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  tel.tick(0); // 先结算 levelStart
  for (const pair of run.state.pairs) {
    tel.act(() => run.startDraw(pair.id, 'a'));
    for (let i = 1; i < pair.path.length; i += 1) {
      tel.act(() => run.drawTo(pair.path[i][0], pair.path[i][1]));
    }
    tel.act(() => run.endDraw());
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

// ---------------- random：随机起色/延伸/提示，验证输入鲁棒（最终超步数判负） ----------------
function random(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let steps = 0;
  while (run.state.phase === 'playing' && steps < 5000) {
    steps += 1;
    const s = run.state;
    if (s.activeColor < 0 || rng() < 0.15) {
      const id = Math.floor(rng() * s.pairs.length);
      const end = rng() < 0.5 ? 'a' : 'b';
      tel.act(() => run.startDraw(id, end));
    } else {
      const path = s.paths[s.activeColor];
      const last = path[path.length - 1];
      const d = dirs[Math.floor(rng() * 4)];
      const res = tel.act(() => run.drawTo(last[0] + d[0], last[1] + d[1]));
      if (!res.ok) tel.act(() => run.endDraw());
    }
    if (rng() < 0.05) tel.act(() => run.hint());
    tel.tick(1 / 60);
  }
  if (run.state.phase === 'playing') tel.act(() => run.giveUp());
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间基线（最终认输） ----------------
function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  for (let i = 0; i < 30 * 60; i += 1) tel.tick(1 / 60);
  tel.act(() => run.giveUp());
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'color-pipes-flow',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
