// NIGHTFALL VEIL · 自对弈（无头直接驱动 sim，零 DOM）。
// 用固定 seed 跑 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
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
        if ((e.type === 'correct' || e.type === 'win') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'lose') this.deaths += 1;
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
  const out = {
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：始终先解最靠近结界的符文，串行打到第 3 关 ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const level = LEVELS[levelIndex];
  const tel = makeTracker(run, 'greedy', seed, carried);
  const MAX_TICKS = Math.ceil((level.timeLimit + level.countdown + 5) * 60);
  for (let t = 0; t < MAX_TICKS; t += 1) {
    if (run.state.phase !== 'playing' && run.state.phase !== 'countdown') break;
    if (run.state.phase === 'playing' && run.state.subjects.length) {
      let low = run.state.subjects[0];
      for (const s of run.state.subjects) if (s.y > low.y) low = s;
      tel.act(() => run.answer(low.result));
    } else {
      tel.tick(1 / 60);
    }
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
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：周期性乱按 0..9，验证输入鲁棒并制造死亡 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_TICKS = Math.ceil((level.timeLimit + level.countdown + 5) * 60);
  let nextAnswer = 30; // 0.5s 后开始乱按
  for (let t = 0; t < MAX_TICKS; t += 1) {
    if (run.state.phase !== 'playing' && run.state.phase !== 'countdown') break;
    if (run.state.phase === 'playing' && t >= nextAnswer) {
      tel.act(() => run.answer(Math.floor(rng() * 10)));
      nextAnswer = t + 30; // 每 0.5s 一次
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测基线死时间与死亡 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const level = LEVELS[0];
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_TICKS = Math.ceil((level.timeLimit + level.countdown + 5) * 60);
  for (let t = 0; t < MAX_TICKS; t += 1) {
    if (run.state.phase !== 'playing' && run.state.phase !== 'countdown') break;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'nightfall-veil',
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
