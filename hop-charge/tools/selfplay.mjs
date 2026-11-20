// HOP CHARGE · 自对弈（Lead 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs

import { createRun, greedyCharge, mulberry32 } from '../src/game/sim.js';
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
      this.tick(1 / 60);
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
    levelsReached: levelsReached ?? tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：贪心（按 greedyCharge 精瞄中心），串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_STEPS = 4000;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const ph = run.state.phase;
    if (ph === 'won' || ph === 'lost') break;
    if (ph === 'ready') {
      tel.act(() => run.press());
      continue;
    }
    if (ph === 'charging') {
      const gc = greedyCharge(run);
      if (!gc) { tel.act(() => run.release()); continue; }
      if (run.state.player.charge >= gc.charge) tel.act(() => run.release());
      else tel.tick(1 / 60);
      continue;
    }
    // jumping
    tel.tick(1 / 60);
  }
  return { run, tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  let reached = 1;
  for (const lv of [0, 1, 2]) {
    const { run, tel } = greedyOnce(lv, seed + lv, carried);
    reached = lv + 1;
    last = finish(tel, run, reached);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

// ---------------- random：随机按/松，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = LEVELS[0].timeLimit + 12;
  while (run.state.phase === 'ready' || run.state.phase === 'charging' || run.state.phase === 'jumping') {
    if (tel.simTime >= MAX_SEC) break;
    if (run.state.phase === 'ready') {
      tel.act(() => run.press());
    } else if (run.state.phase === 'charging') {
      const target = 0.05 + rng() * (1.6 - 0.05);
      if (run.state.player.charge >= target) tel.act(() => run.release());
      else tel.tick(1 / 60);
    } else {
      tel.tick(1 / 60);
    }
  }
  // 兜底：时间到仍未结算则继续推到结算
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && tel.simTime < MAX_SEC + 2) tel.tick(1 / 60);
  return finish(tel, run, 1);
}

// ---------------- noinput：什么都不做，测「没有死时间」的自动推进基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = LEVELS[0].timeLimit + 3;
  while (run.state.phase === 'ready' || run.state.phase === 'charging' || run.state.phase === 'jumping') {
    if (tel.simTime >= MAX_SEC) break;
    tel.tick(1 / 60);
  }
  return finish(tel, run, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'hop-charge',
  genre: 'arcade',
  source: 'bot',
  version: 'v1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} ` +
    `maxGap=${r.maxEventGapSec.toFixed(1)}s completed=${r.completed} level=${r.levelsReached}`,
  );
}
