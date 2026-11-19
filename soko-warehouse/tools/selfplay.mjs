// SOKO WAREHOUSE · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { solveLevel } from '../src/game/level.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DIRS = ['up', 'down', 'left', 'right'];

function makeTracker(policy, seed, carried) {
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
    tick(dt) { this.simTime += dt; },
    act(run, fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.simTime += 1 / 60;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
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
  return {
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
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

// greedy：用 A* 最优解回放 L1→L2→L3（保证推进到第 3 关）
function greedy(seed) {
  const tel = makeTracker('greedy', seed, null);
  let levelsReached = 1;
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    lastRun = run;
    tel.level = lv + 1;
    levelsReached = lv + 1;
    const sol = solveLevel(LEVELS[lv]);
    if (!sol) break;
    for (const m of sol.moves) tel.act(run, () => run.move(m));
    if (run.state.phase !== 'won') break;
  }
  return finish(tel, lastRun, levelsReached);
}

// random：随机四方向直到失败（步数超限），验证输入鲁棒 + 死亡存在性
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker('random', seed, null);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 400) {
    tel.act(run, () => run.move(DIRS[Math.floor(rng() * 4)]));
    guard += 1;
  }
  // 兜底推进
  let t = 0;
  while (run.state.phase === 'playing' && t < 120) { tel.tick(1 / 60); t += 1; }
  return finish(tel, run, 1);
}

// noinput：只推进时间，测空转基线（不产生动作）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker('noinput', seed, null);
  for (let t = 0; t < 120; t += 1) tel.tick(1 / 60);
  return finish(tel, run, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'soko-warehouse',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
