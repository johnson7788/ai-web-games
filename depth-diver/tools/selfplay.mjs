// Depth Diver · 自对弈（Node 无头，直接 import sim）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
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
    levelsReached: run.state.level,
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：优先安全航迹（最近的可通行航迹），其次贴同航迹样本 ----------------
function decide(run) {
  const s = run.state;
  const p = s.player;
  const look = 520;
  const windowObs = s.obstacles.filter((o) => o.y > p.y - 60 && o.y < p.y + look);
  const blocked = new Set();
  for (const o of windowObs) {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < GAME.LANE_X.length; i += 1) {
      const d = Math.abs(GAME.LANE_X[i] - o.x);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bd < 130) blocked.add(bi);
  }
  const free = GAME.LANE_X.map((_, i) => i).filter((i) => !blocked.has(i));

  // 只取「离玩家最近的 free 航迹」，绝不跨过被封航迹（安全第一）
  let targetLane = 2;
  let bd = Infinity;
  for (const i of free) {
    const d = Math.abs(GAME.LANE_X[i] - p.x);
    if (d < bd) { bd = d; targetLane = i; }
  }
  const targetX = GAME.LANE_X[targetLane];
  const left = p.x > targetX + 24;
  const right = p.x < targetX - 24;
  let thrust = false;
  for (const o of windowObs) {
    if (o.y > p.y && o.y - p.y < 150 && Math.abs(o.x - p.x) < 120) { thrust = true; break; }
  }
  if (p.y > 555) thrust = true;
  return { thrust, left, right, dive: false };
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_SEC = LEVELS[levelIndex].oxygen + 6;
  let lastCmd = null;
  let guard = Math.ceil(MAX_SEC * 60);
  let sinceDecide = 0;
  const DECIDE_EVERY = 9; // ≈0.15s 一个决策（真实躲避机器人节奏）
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (sinceDecide <= 0) {
      const cmd = decide(run);
      if (!lastCmd || cmd.thrust !== lastCmd.thrust || cmd.left !== lastCmd.left || cmd.right !== lastCmd.right) {
        tel.act(() => run.input(cmd));
        lastCmd = cmd;
      }
      sinceDecide = DECIDE_EVERY;
    }
    sinceDecide -= 1;
    tel.tick(1 / 60);
  }
  tel.levelsReached = run.state.level;
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let lastTel = null;
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyOnce(lv, seed + lv, carried);
    lastTel = tel;
    lastRun = run;
    carried = tel;
    if (run.state.phase !== 'won') break;
    // 已通关，准备下一关（1 基 level 前进）
  }
  return finish(lastTel, lastRun);
}

// ---------------- random：随机乱按，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = LEVELS[LEVEL_INDEX].oxygen + 8;
  let guard = Math.ceil(MAX_SEC * 60);
  while (run.state.phase === 'playing' && guard-- > 0) {
    tel.act(() => run.input({
      thrust: rng() < 0.5,
      left: rng() < 0.4,
      right: rng() < 0.4,
      dive: rng() < 0.2,
    }));
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，测自动推进基线 ----------------
function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = LEVELS[LEVEL_INDEX].oxygen + 5;
  let guard = Math.ceil(MAX_SEC * 60);
  while (run.state.phase === 'playing' && guard-- > 0) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'depth-diver',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
