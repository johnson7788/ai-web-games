// PIN & POUR · 自对弈（无头，直接 import sim）
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 用 solver 的获胜顺序串行打 L1→L2→L3。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { findSolution } from '../src/game/level.js';
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

function settle(tel, run, maxSec = 10) {
  let guard = 0;
  const cap = Math.ceil(maxSec * 60);
  while (run.state.phase === 'playing' && guard < cap) {
    if (run.isSettled()) break;
    tel.tick(1 / 60);
    guard += 1;
  }
  // 强制再跑一个物理 tick，把 'settle' 事件刷出来（真实 60Hz 循环里会自然发出）
  if (run.state.phase === 'playing') {
    run.tick();
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lose') tel.deaths += 1;
    }
  }
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

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const sol = findSolution(levelIndex) || [];
  for (const id of sol) {
    if (run.state.phase !== 'playing') break;
    tel.act(() => run.pullGate(id));
    settle(tel, run);
  }
  settle(tel, run, 6);
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
  // 用带气泡陷阱的 L3 打：随机顺序抽闸，先抽蜂蜜底闸就会污染 → 至少一次死亡。
  const levelIndex = 2;
  const run = createRun(levelIndex, { seed });
  const level = LEVELS[levelIndex];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const ids = level.gates.map((g) => g.id);
  // Fisher-Yates 洗牌（随机顺序抽闸）
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (const id of ids) {
    if (run.state.phase !== 'playing') break;
    tel.act(() => run.pullGate(id));
    settle(tel, run);
  }
  settle(tel, run, 6);
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 12;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'pin-and-pour',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
