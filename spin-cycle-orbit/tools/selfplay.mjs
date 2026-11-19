// SPIN CYCLE ORBIT · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { ORBIT } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const GREEDY_CAP = 20; // 无尽模式：greedy 完美玩到 20 次捕获即算「完成一局」

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
    tick() {
      run.step();
      this.simTime += 1 / 60;
      this.drain();
    },
    drain() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'capture' || e.type === 'golden' || e.type === 'rock') {
          if (this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      this.actions += 1; // 每次被游戏处理的操作都算（tap 成功捕获或 miss 判负）
      const res = fn();
      this.drain();
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
    levelsReached: run.state.level,
    completed: run.state.phase === 'over' ? run.state.captures >= GREEDY_CAP : run.state.captures >= GREEDY_CAP,
  };
}

// greedy：在命中窗口内完美点击，直到 GREEDY_CAP 次捕获
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_FRAMES = 60 * 60; // 60s 兜底
  for (let f = 0; f < MAX_FRAMES; f += 1) {
    if (run.state.phase !== 'playing') break;
    tel.tick();
    if (run.state.phase !== 'playing') break;
    if (run.nextDistance() < ORBIT.CAPTURE_DIST) {
      tel.act(() => run.tap());
    }
    if (run.state.captures >= GREEDY_CAP) break;
  }
  tel.drain();
  return finish(tel, run);
}

// random：每帧乱按（乱按必死，验证输入鲁棒 + 死亡存在性）
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  while (run.state.phase === 'playing' && tel.simTime < 10) {
    tel.tick();
    if (run.state.phase !== 'playing') break;
    tel.act(() => run.tap());
  }
  tel.drain();
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死时间基线（宽限期后 overshoot 自动死亡）
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 30) {
    tel.tick();
  }
  tel.drain();
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'spin-cycle-orbit',
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
