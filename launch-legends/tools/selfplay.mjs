// LAUNCH LEGENDS · 自对弈（无头遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成对局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
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
        if ((e.type === 'cloudBreak' || e.type === 'pass') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    setInput(dir) {
      const r = run.setInput(dir);
      if (r.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return r.ok;
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：沿安全通道对齐，串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  const MAX_STEPS = 4000;
  for (let step = 0; step < MAX_STEPS && run.state.phase === 'playing'; step += 1) {
    const before = run.state.dir;
    run.autopilotStep();
    if (run.state.dir !== before) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    tel.tick(1 / 60);
  }
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

// ---------------- random：随机方向，验证输入鲁棒与边界 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 40;
  let dir = 0;
  let changeIn = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (changeIn <= 0) {
      const roll = rng();
      dir = roll < 0.4 ? -1 : roll < 0.8 ? 1 : 0;
      changeIn = 0.15 + rng() * 0.5;
      tel.setInput(dir);
    }
    changeIn -= 1 / 60;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 40;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(4)];
const payload = {
  game: 'launch-legends',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
