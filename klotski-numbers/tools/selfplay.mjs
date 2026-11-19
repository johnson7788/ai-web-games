// KLOTSKI NUMBERS · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成对局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy：IDA* 解 3×3/4×4，5×5 用贪心单步兜底（到达即可，不强求通关），串行 L1→L2→L3。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { solveBoard, bestMoveIndex } from '../src/game/solver.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const SLIDE = 0.18; // 每次滑动的动画时长（与 GAME.SLIDE_SEC 一致）

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
        this.tick(SLIDE);
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const n = run.state.size;

  // 各关卡演示道具（产生 hint / shuffle 事件，供遥测事件种类）
  if (levelIndex === 0 && run.state.hintLeft > 0) tel.act(() => run.hint());
  if (levelIndex === 1 && run.state.shuffleLeft > 0) tel.act(() => run.shuffle());

  const path = solveBoard(run.state.cells.slice(), n);
  if (path) {
    for (const t of path) {
      if (run.state.phase !== 'playing') break;
      tel.act(() => run.move(t));
    }
  } else {
    // 5×5：贪心单步兜底，验证输入鲁棒，不强求解出
    for (let i = 0; i < 80 && run.state.phase === 'playing'; i += 1) {
      const t = bestMoveIndex(run.state.cells, n);
      if (t < 0) break;
      tel.act(() => run.move(t));
    }
    while (run.state.phase === 'playing' && tel.simTime < 30) tel.tick(1 / 60);
  }
  return { rec: finish(tel, run), tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { rec, tel } = greedyOnce(lv, seed + lv, carried);
    last = rec;
    carried = {
      simTime: tel.simTime,
      firstInputAt: tel.firstInputAt,
      firstSuccessAt: tel.firstSuccessAt,
      deaths: tel.deaths,
      actions: tel.actions,
      seen: new Set([...tel.seen]),
      eventTimes: [...tel.eventTimes],
    };
    if (!rec.completed) break;
  }
  return last;
}

// ---------------- random：随机合法滑动，测输入鲁棒，跑到终局或超时 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const n = run.state.size;
  const cap = run.state.timeLimit + 5;
  while (run.state.phase === 'playing' && tel.simTime < cap) {
    const blank = run.state.blank;
    const cands = [];
    for (let t = 0; t < n * n; t += 1) {
      if (t === blank) continue;
      if (Math.floor(t / n) === Math.floor(blank / n) || (t % n) === (blank % n)) cands.push(t);
    }
    const t = cands[Math.floor(rng() * cands.length)];
    tel.act(() => run.move(t));
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/超时基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const cap = run.state.timeLimit + 5;
  while (run.state.phase === 'playing' && tel.simTime < cap) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'klotski-numbers',
  genre: 'puzzle',
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
