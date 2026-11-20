// SKY STRIKE ALPHA · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 L1→L2→L3（greedy 串行），写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { greedyHold } from '../src/game/autopilot.js';
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
    seen: new Set(carried && carried.seen ? [...carried.seen] : []),
    eventTimes: (carried && carried.eventTimes) ? [...carried.eventTimes] : [0],
    lastHold: (carried && carried.lastHold) ?? null,
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
    hold(v) {
      const res = run.setHold(v);
      if (res && res.changed) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.lastHold = res ? res.hold : null;
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
  };
}

function greedyRun(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  const MAX_STEPS = 60 * 60 * 1; // 60s @ 60fps
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    if (run.state.phase === 'ready') {
      tel.hold(true);
      tel.tick(1 / 60);
      continue;
    }
    tel.hold(greedyHold(run));
    tel.tick(1 / 60);
  }
  return { tel, run };
}

function randomRun(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  for (let i = 0; i < 60 * 40; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    if (run.state.phase === 'ready') { tel.hold(true); tel.tick(1 / 60); continue; }
    tel.hold(rng() < 0.5);
    tel.tick(1 / 60);
  }
  return { tel, run };
}

function noinputRun(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  for (let i = 0; i < 60 * 12; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    tel.tick(1 / 60);
  }
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyRun(lv, seed + lv, carried);
    last = finish(tel, run);
    if (!last.completed) break;
    carried = tel;
  }
  return last;
}

const { tel: rt, run: rr } = randomRun(2);
const { tel: nt, run: nr } = noinputRun(3);
const runs = [greedy(3), finish(rt, rr), finish(nt, nr)];

const payload = {
  game: 'sky-strike-alpha',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
