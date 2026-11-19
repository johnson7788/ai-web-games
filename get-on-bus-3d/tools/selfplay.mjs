// GET ON BUS 3D · 自对弈（Node 无头，直接 import sim，无 DOM）
// greedy / random / noinput 三策略，固定 seed 驱动，写出 tools/fun/autoplay.json。
// greedy 用「克隆 + 前瞻」决定油门/刹车，串行打 L1→L2→L3（推进率门槛需到第 3 关）。
import { createRun, cloneState, stepState, mulberry32 } from '../src/game/sim.js';
import { STEP } from '../config/game.config.js';
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
        if (e.type === 'dropoff' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'crash') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(STEP);
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
}

// 前瞻：以固定油门模拟 horizon 秒，判断是否会撞车
function wouldCrash(st, gasOn, horizon = 1.5) {
  const c = cloneState(st);
  c.gas = gasOn;
  const steps = Math.ceil(horizon / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepState(c, STEP, null);
    if (c.phase === 'crashed') return true;
    if (c.phase === 'won') return false;
  }
  return false;
}

// greedy：油门会撞就松，否则按住
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_STEPS = 3600;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'countdown' && run.state.phase !== 'running') break;
    let g = true;
    if (run.state.phase === 'running') g = !wouldCrash(run.state, true);
    tel.act(() => run.gas(g));
    if (run.state.phase === 'won') break;
  }
  return { result: finish(tel, run), tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { result, tel } = greedyOnce(lv, seed + lv, carried);
    last = result;
    carried = tel;
    if (!result.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_STEPS = 3600;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'countdown' && run.state.phase !== 'running') break;
    // 鲁莽司机：长时间踩着油门全速冲，偶尔（~8%）松一脚 → 撞车概率极高
    const gas = rng() < 0.92;
    tel.act(() => run.gas(gas));
    if (run.state.phase === 'won') break;
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 3600;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'countdown' && run.state.phase !== 'running') break;
    tel.act(() => run.gas(false));
    if (run.state.phase === 'won') break;
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'get-on-bus-3d',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} completed=${r.completed}`,
  );
}
