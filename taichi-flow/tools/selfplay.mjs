// TAICHI FLOW · 自对弈（Node 无头，直接 import sim，无 DOM）。
// greedy（逆解构造序列）/ random（随机点格，验证输入鲁棒与判负）/ noinput（只推进时间）。
// 完成后写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { LEVELS, mulberry32 } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  return {
    id: policy,
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
    doAction(res) {
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
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
  };
}

// ---------------- greedy：逆向回放关卡构造时的打乱序列（= 已知构造的最短解） ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, {});
  const tel = makeTracker(run, 'greedy', seed, carried);
  for (const idx of [...run.state.scramble].reverse()) {
    if (run.state.phase !== 'playing') break;
    const res = run.click(idx);
    tel.doAction(res);
    tel.tick(1 / 60);
  }
  return { run, tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  let run = null;
  for (const lv of [0, 1, 2]) {
    const r = greedyOnce(lv, seed + lv, carried);
    run = r.run;
    last = r.tel;
    carried = last;
    if (run.state.phase !== 'won') break;
  }
  return finish(last, run);
}

// ---------------- random：随机点格，验证输入鲁棒 + 步数判负 ----------------
function random(seed) {
  const run = createRun(0, {});
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const idx = Math.floor(rng() * 49);
    const res = run.click(idx);
    tel.doAction(res);
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/基线 ----------------
function noinput(seed) {
  const run = createRun(0, {});
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 40;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'taichi-flow',
  genre: 'puzzle',
  source: 'bot',
  version: 'm1',
  _howto: 'greedy/random/noinput 三策略；schema 见 references/playtest-protocol.md §3',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed}`,
  );
}
