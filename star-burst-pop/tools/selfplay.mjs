// STAR BURST POP · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完整打完 3 关战役并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createSim, select, pop, tick, drainEvents, allGroups } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const ACTION_SEC = 0.35; // 每次有效操作 ≈ 引爆+下落动画耗时

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
      tick(run, dt);
      this.simTime += dt;
      for (const e of drainEvents(run)) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'levelClear' || e.type === 'win') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(ACTION_SEC);
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
    level: 1,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.level,
    completed: run.phase === 'won',
  };
}

// 贪心：每次引爆最大同色团
function greedy(seed) {
  const run = createSim(1, seed);
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.phase === 'playing' && guard < 1200) {
    guard += 1;
    const groups = allGroups(run.grid);
    if (!groups.length) break;
    groups.sort((a, b) => b.length - a.length);
    const g = groups[0];
    tel.act(() => select(run, g[0][0], g[0][1]));
    tel.act(() => pop(run));
  }
  return finish(tel, run);
}

// 随机：随机引爆一个同色团（验证输入鲁棒）
function random(seed) {
  const run = createSim(1, seed);
  const tel = makeTracker(run, 'random', seed);
  let guard = 0;
  while (run.phase === 'playing' && guard < 1200) {
    guard += 1;
    const groups = allGroups(run.grid);
    if (!groups.length) break;
    const g = groups[Math.floor(run.rng() * groups.length)];
    tel.act(() => select(run, g[0][0], g[0][1]));
    tel.act(() => pop(run));
  }
  return finish(tel, run);
}

// 无输入：只推进时间（死时间基线）
function noinput(seed) {
  const run = createSim(1, seed);
  const tel = makeTracker(run, 'noinput', seed);
  while (tel.simTime < 20) tel.tick(ACTION_SEC);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'star-burst-pop',
  genre: 'sim', // 无死亡压力：星级 mastery 目标；minLevels=3 仍要求贪心到达第 3 关
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
    `actions=${r.actions} events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
