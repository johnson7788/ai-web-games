// Frenzy Racer · 自对弈（Node 无头，直接 import sim）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
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

// 贪婪驾驶：返回「下一个该做的换道动作」（每轮一个，镜像 act-then-continue 模式）
function nextGreedyAction(run) {
  for (const car of ['c1', 'c2']) {
    const next = run.state.entities
      .filter((e) => !e.resolved && e.arrive >= run.state.time && (e.lane < 2 ? 'c1' : 'c2') === car)
      .sort((a, b) => a.arrive - b.arrive)[0];
    if (!next) continue;
    const lp = next.lane % 2;
    const here = run.state.cars[car] === lp;
    if (next.kind === 'barrier') { if (here) return () => run.switchCar(car); }
    else { if (!here) return () => run.switchCar(car); }
  }
  return null;
}

function playToEnd(run, tel, maxSec = 90) {
  const maxTicks = Math.round(maxSec * 60);
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard < maxTicks) {
    if (run.state.phase === 'playing') {
      const act = nextGreedyAction(run);
      if (act) { tel.act(act); continue; }
    }
    tel.tick(1 / 60);
    guard += 1;
  }
  return guard;
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  if (tel0) tel.level = run.state.level;
  playToEnd(run, tel, 90);
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

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard < 60 * 90) {
    if (run.state.phase === 'playing') {
      const roll = rng();
      if (roll < 0.4) { tel.act(() => run.switchCar('c1')); continue; }
      if (roll < 0.8) { tel.act(() => run.switchCar('c2')); continue; }
    }
    tel.tick(1 / 60);
    guard += 1;
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard < 60 * 90) {
    tel.tick(1 / 60);
    guard += 1;
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'frenzy-racer',
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
    `${r.id.padEnd(12)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
