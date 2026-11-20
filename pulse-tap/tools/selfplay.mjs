// PULSE TAP · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy：按谱面时间轴完美命中所有真实 note（跳过假 note），串行打 L1→L2→L3。
// random：随机按轨，验证输入鲁棒与边界；noinput：什么都不做，验证漏判扣血与失败基线。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);

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
    levelsReached: (carried && carried.levelsReached) ?? run.state.level,
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
    tap(track) {
      const res = run.tap(track);
      if (res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        if (this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
    _tel: tel,
  };
}

function stepTo(run, tel, t) {
  while (run.state.phase === 'countdown') tel.tick(1 / 60);
  let guard = 0;
  while (run.state.time < t && run.state.phase === 'playing' && guard++ < 200000) {
    tel.tick(Math.min(1 / 60, t - run.state.time));
  }
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  tel.level = run.state.level;
  tel.levelsReached = Math.max(tel.levelsReached, run.state.level);

  const real = run.state.notes.filter((n) => REAL.has(n.kind));
  for (const n of real) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    stepTo(run, tel, n.time);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    tel.tap(n.track);
  }
  stepTo(run, tel, run.state.duration);
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv * 13, carried);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard++ < 200000) {
    const t = tel.simTime;
    if (t > 60) break; // 60s 上限，随机策略只需证明鲁棒与失败基线
    // 乱按：每帧约 10% 概率按一条随机轨。ghost tap 也是游戏接受的输入（断连），计入 actions。
    if (run.state.phase === 'playing' && rng() < 0.1) {
      run.tap(Math.floor(rng() * 4));
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
      if (run.state.combo > 0 && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard++ < 200000) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'pulse-tap',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
