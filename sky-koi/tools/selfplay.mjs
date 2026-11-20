// SKY KOI · 自对弈（Node 无头，直接 import sim）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-${run.state.level}`,
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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
    _tel: tel,
  };
}

// ---------------- greedy：贴着门缝中心（或珍珠）扑 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_SEC = 120;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (!run.state.started) {
      tel.act(() => run.flap()); // 第一扑：开局
      tel.tick(1 / 60);
      continue;
    }
    const gate = run.gateAhead();
    if (!gate) {
      if (run.state.koi.vy > 0 && run.state.koi.y > 350) tel.act(() => run.flap());
    } else if (run.state.koi.vy > 0 && run.state.koi.y > gate.targetY - 10) {
      tel.act(() => run.flap());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv * 1000, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：乱按，验证输入鲁棒与边界 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 90;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (rng() < 0.05) tel.act(() => run.flap());
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：开局即下落（不扑），验证自动推进/死亡基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  run.start(); // 相当于「按下开始但之后没有任何操作」
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'sky-koi',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents}`,
  );
}
