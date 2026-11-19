// Draw Truck Path · 自对弈（Node 无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

// 每关的最优绕行路线（greedy 用）
const SOLUTIONS = [
  [{ x: 200, y: 470 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 520, y: 250 }, { x: 760, y: 250 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 350, y: 260 }, { x: 560, y: 260 }, { x: 700, y: 540 }, { x: 860, y: 540 }, { x: 1085, y: 470 }],
];

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return res;
    },
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number(((tel.firstInputAt ?? 0)).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// greedy：画最优路线 + 向右发车，串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const pts = SOLUTIONS[levelIndex];
  tel.act(() => run.beginStroke(pts[0].x, pts[0].y));
  for (let i = 1; i < pts.length; i += 1) tel.act(() => run.moveStroke(pts[i].x, pts[i].y));
  tel.act(() => run.endStroke());
  tel.act(() => run.setDrive(1));
  let guard = 4000;
  while (guard-- > 0 && run.state.phase === 'playing') tel.tick(1 / 60);
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

// random：随机画线/左右发车，验证输入鲁棒（通常会坠坑死亡）
function random(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = Math.min(20, level.timeLimit + 4);
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.4) {
      const x0 = 140 + rng() * 900;
      const y0 = 220 + rng() * 340;
      tel.act(() => run.beginStroke(x0, y0));
      for (let i = 0; i < 3; i += 1) {
        tel.act(() => run.moveStroke(x0 + (rng() - 0.5) * 460, y0 + (rng() - 0.5) * 300));
      }
      tel.act(() => run.endStroke());
    } else if (roll < 0.6) {
      tel.act(() => run.setDrive(1));
    } else if (roll < 0.8) {
      tel.act(() => run.setDrive(-1));
    } else {
      tel.act(() => run.setDrive(0));
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死时间基线（倒计时归零 → 死亡）
function noinput(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = level.timeLimit + 3;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'draw-truck-path',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
