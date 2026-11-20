// MOSAIC SLIDE · 自对弈（Node 无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy = 倒放缺口游走（+ 修旋转）串行打到第 3 关。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { solveScramble, indexToRC } from '../src/game/solver.js';
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
      } else {
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

function solveRun(run, tel) {
  const sol = solveScramble(run._blankSeq, run._scrambleDepth);
  for (const cell of sol) {
    if (run.state.phase !== 'playing') break;
    const { r, c } = indexToRC(cell, run.state.cols);
    const res = tel.act(() => run.slide(r, c));
    if (!res.ok) break;
  }
  if (run.state.rotate && run.state.phase === 'playing') {
    for (let cell = 1; cell < run.state.board.length; cell += 1) {
      if (run.state.phase !== 'playing') break;
      const t = run.state.board[cell];
      let guard = 0;
      while (run.state.rot[cell] !== run.state.homeRot[t] && guard++ < 4) {
        const { r, c } = indexToRC(cell, run.state.cols);
        tel.act(() => run.rotate(r, c));
      }
    }
  }
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  solveRun(run, tel);
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2;
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = level.time + 10;
  while (run.state.phase === 'playing') {
    if (tel.simTime >= MAX_SEC) break;
    const r = Math.floor(rng() * level.rows);
    const c = Math.floor(rng() * level.cols);
    if (rng() < 0.8) tel.act(() => run.slide(r, c));
    else tel.act(() => run.rotate(r, c));
    tel.tick(1 / 60);
  }
  while (run.state.phase === 'playing' && tel.simTime < level.time + 2) tel.tick(1 / 60);
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'playing') {
    if (tel.simTime >= MAX_SEC) break;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'mosaic-slide',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
