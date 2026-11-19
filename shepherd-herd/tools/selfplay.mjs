// SHEPHERD HERD · 自对弈（Node 无头，直接 import sim，无 DOM）。
// greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, STEP } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { LEVELS } from '../config/levels.js';
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
    level: 1,
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
      return res;
    },
  };
}

function finish(tel, run, levelsReached) {
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
    level: levelsReached,
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
    completed: run.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：逐只喂未喂过的羊，串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  let guard = 6000;
  while (guard-- > 0 && (run.phase === 'countdown' || run.phase === 'playing')) {
    if (run.phase === 'playing' && run.cooldown <= 0) {
      const sh = run.sheep.find((s) => !s.fed);
      if (sh) tel.act(() => run.tap(sh.x, sh.y));
    }
    tel.tick(STEP);
  }
  return finish(tel, run, levelIndex + 1);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  let levelsReached = 0;
  for (const lv of [0, 1, 2]) {
    levelsReached = lv + 1;
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
  }
  last.levelsReached = levelsReached;
  return last;
}

// ---------------- random：每步随机点一只羊，验证输入鲁棒 ----------------
function randomOnce(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = LEVELS[0].time + 3;
  while ((run.phase === 'countdown' || run.phase === 'playing') && tel.simTime < MAX_SEC) {
    if (run.phase === 'playing' && run.cooldown <= 0) {
      const sh = run.sheep[Math.floor(rng() * run.sheep.length)];
      tel.act(() => run.tap(sh.x, sh.y));
    }
    tel.tick(STEP);
  }
  return finish(tel, run, 1);
}

// ---------------- noinput：只推进时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = LEVELS[0].time + 3;
  while ((run.phase === 'countdown' || run.phase === 'playing') && tel.simTime < MAX_SEC) {
    tel.tick(STEP);
  }
  return finish(tel, run, 1);
}

const runs = [greedy(3), randomOnce(2), noinput(3)];
const payload = {
  game: 'shepherd-herd',
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
