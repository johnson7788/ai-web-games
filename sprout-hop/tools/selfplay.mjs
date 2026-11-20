// Sprout Hop · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// greedy 串行打到第 3 关，写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { aimToPlatform, mulberry32 } from '../src/game/level.js';
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
    maxLevel: run.state.level, // 当前（串行时即已到达的最高）关卡，1 基
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
    levelsReached: tel.maxLevel,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：瞄准下一平台中心，串行打到第 3 关 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_STEPS = 20000;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase === 'won') break;
    if (run.state.phase === 'lost') {
      if (run.state.relivesUsed < run.state.maxRelives) { tel.act(() => run.revive()); continue; }
      break;
    }
    if (run.state.phase === 'aiming') {
      tel.act(() => run.aimStart());
      const spd = aimToPlatform(run.state, run.state.cur + 1);
      if (!spd) break;
      tel.act(() => run.launch(spd));
      continue;
    }
    tel.tick(1 / 60); // flying
  }
  // 若仍在 flying 但已落水边缘，推进到终局（兜底）
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'flying') tel.tick(1 / 60);
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

// ---------------- random：乱按，验证输入鲁棒与死亡存在 ----------------
function random(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 22;
  while (tel.simTime < MAX_SEC && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    if (run.state.phase === 'aiming') {
      tel.act(() => run.aimStart());
      const dx = 80 + rng() * 520;
      const dy = -240 + rng() * 440;
      tel.act(() => run.launch({ x: dx, y: dy }));
    } else {
      tel.tick(1 / 60);
    }
  }
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'flying') tel.tick(1 / 60);
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，验证无死时间基线 ----------------
function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 12;
  while (tel.simTime < MAX_SEC && run.state.phase !== 'won' && run.state.phase !== 'lost') {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), random(4), noinput(3)];
const payload = {
  game: 'sprout-hop',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
