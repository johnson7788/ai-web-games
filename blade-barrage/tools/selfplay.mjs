// BLADE BARRAGE · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, bounceXAt } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const BLADE_X = GAME.BLADE_X;
const TARGET_HITS = 8;   // 到达 wave 3（推进率门槛）
const TARGET_GEMS = 1;

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
        if (e.type === 'hit' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'die') this.deaths += 1;
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
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.wave,
    completed: run.state.phase === 'lost',
  };
}

// 预测：目标 y 处，t 秒后目标水平位置距 blade 列的偏移
function offsetAt(target, t) {
  const p = bounceXAt(target.x, target.vx, target.xMin, target.xMax, t);
  return Math.abs(p.x - BLADE_X);
}
function flightT(targetY) {
  return (GAME.BLADE_START_Y - targetY) / GAME.BLADE_SPEED;
}

// ---------------- greedy：预测弹道，命中核心/宝石，达标后故意失误结束 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_STEPS = 24000; // 上限 400s，防死循环
  for (let step = 0; step < MAX_STEPS && run.state.phase === 'playing'; step += 1) {
    const s = run.state;
    if (!s.blade.fired) {
      const gem = s.pickups.find((p) => !p.collected);
      if (s.gems < TARGET_GEMS && gem && Math.abs(gem.x - BLADE_X) < 140) {
        const off = offsetAt(gem, flightT(gem.y));
        if (off <= gem.r + GAME.BLADE_HALF_W + 6) tel.act(() => run.fire());
        else tel.tick(1 / 60);
      } else if (s.hits < TARGET_HITS) {
        const c = s.core;
        const off = offsetAt(c, flightT(c.y));
        if (off <= c.radius * 0.25) tel.act(() => run.fire());
        else tel.tick(1 / 60);
      } else {
        // 达标：故意失误（核心远离中线时发射，撞顶部尖刺）
        const off = Math.abs(s.core.x - BLADE_X);
        if (off > 160) tel.act(() => run.fire());
        else tel.tick(1 / 60);
      }
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// ---------------- random：高频随机发射，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  // 用独立 mulberry 序列驱动「何时发射」，不与 sim 的 rng 混用
  let s0 = (seed * 7919 + 13) >>> 0;
  const rng = () => {
    s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0;
    let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let nextFireIn = 0.05 + rng() * 0.2;
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const s = run.state;
    if (!s.blade.fired) {
      nextFireIn -= 1 / 60;
      if (nextFireIn <= 0) {
        tel.act(() => run.fire());
        nextFireIn = 0.05 + rng() * 0.3;
      } else {
        tel.tick(1 / 60);
      }
    } else if (s.blade.flightT > 0.15 && rng() < 0.2) {
      tel.act(() => run.burst());
    } else {
      tel.tick(1 / 60);
    }
  }
  // 兜底：还没结束就强制结束
  if (run.state.phase === 'playing') run.forceEnd('topSpike');
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动死亡基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 20;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  if (run.state.phase === 'playing') run.forceEnd('bottomSpike');
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'blade-barrage',
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
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
