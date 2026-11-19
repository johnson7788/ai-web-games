// 花园大亨 · 自对弈（builder 拥有）
// Node 无头，直接 import sim（无 DOM）。驱动 greedy / random / noinput 三策略，
// 各跑一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, growthAt } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'harvest' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.gardenLevel,
    completed: run.state.gardenLevel >= 3,
  };
}

// 单步决策：rock > harvest > evolve > upgrade > unlock > water > 空转。
// greedy 选最优/第一个目标；random 随机选目标（乱按策略但保留基本动作）。
function stepOnce(run, tel, rng, policy) {
  const s = run.state;
  // 岩石（可击碎）
  for (const r of s.rocks) {
    if (r.ready) { tel.act(() => run.breakRock(r.id)); return; }
  }
  // 收获
  const ready = [];
  for (let i = 0; i < 9; i += 1) {
    const p = s.plots[i];
    if (p.unlocked && p.species > 0 && growthAt(s, i).accumulated >= 1) ready.push(i);
  }
  if (ready.length) {
    let idx;
    if (policy === 'greedy') {
      idx = ready.reduce((a, b) => (growthAt(s, a).accumulated >= growthAt(s, b).accumulated ? a : b));
    } else {
      idx = ready[Math.floor(rng() * ready.length)];
    }
    tel.act(() => run.harvest(idx));
    return;
  }
  // 进化
  const canEvolve = [];
  for (let i = 0; i < 9; i += 1) if (run.canEvolve(i)) canEvolve.push(i);
  if (canEvolve.length) {
    const idx = policy === 'greedy' ? canEvolve[0] : canEvolve[Math.floor(rng() * canEvolve.length)];
    tel.act(() => run.evolve(idx));
    return;
  }
  // 升级
  const canUp = [];
  for (let i = 0; i < 9; i += 1) if (run.canUpgrade(i)) canUp.push(i);
  if (canUp.length) {
    const idx = policy === 'greedy' ? canUp[0] : canUp[Math.floor(rng() * canUp.length)];
    tel.act(() => run.upgrade(idx));
    return;
  }
  // 解锁
  const canUnlock = [];
  for (let i = 0; i < 9; i += 1) if (run.canUnlock(i)) canUnlock.push(i);
  if (canUnlock.length) {
    const idx = policy === 'greedy' ? canUnlock[0] : canUnlock[Math.floor(rng() * canUnlock.length)];
    tel.act(() => run.unlockPlot(idx));
    return;
  }
  // 水滴（greedy 只在水位较高时浇，避免浪费；random 随机浇）
  const growable = [];
  for (let i = 0; i < 9; i += 1) {
    const p = s.plots[i];
    if (p.unlocked && p.species > 0) growable.push(i);
  }
  if (growable.length && s.water >= 1) {
    const useWater = policy === 'greedy' ? s.water >= 6 : rng() < 0.35;
    if (useWater) {
      const idx = growable[Math.floor(rng() * growable.length)];
      tel.act(() => run.water(idx));
      return;
    }
  }
  tel.tick(1 / 60);
}

function runGreedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let a = seed >>> 0;
  const rng = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const MAX = 180 * 60;
  for (let step = 0; step < MAX && run.state.gardenLevel < 3; step += 1) {
    stepOnce(run, tel, rng, 'greedy');
  }
  return finish(tel, run);
}

function runRandom(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  let a = seed >>> 0;
  const rng = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const MAX = 120 * 60;
  for (let step = 0; step < MAX; step += 1) stepOnce(run, tel, rng, 'random');
  return finish(tel, run);
}

function runNoinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX = 90 * 60;
  for (let step = 0; step < MAX; step += 1) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [runGreedy(7), runRandom(11), runNoinput(3)];
const payload = { game: 'garden-bloom-tycoon', genre: 'sim', source: 'bot', version: 'm1', runs };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} events=${r.uniqueEvents} level=${r.levelsReached} completed=${r.completed}`,
  );
}
