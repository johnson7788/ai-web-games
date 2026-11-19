// Traffic Commute · 自对弈：greedy / random / noinput 三策略 → tools/fun/autoplay.json
// Node 无头，直接 import sim（无 DOM）。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: 1,
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
        if ((e.type === 'star' || e.type === 'win') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'wrong' || e.type === 'timeout') this.deaths += 1;
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
    levelsReached: run.state.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// greedy：读题即答对，首答全对走完整局
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  tel.tick(0.6);
  let guard = 40;
  while (run.state.phase === 'playing' && guard-- > 0) {
    tel.tick(0.3);
    const correct = run.state.question.correct[0];
    tel.act(() => run.answer(correct));
  }
  tel.tick(0.5);
  return finish(tel, run);
}

// random：随机乱点（验证输入鲁棒 + 提供死时间/失败基线）
function random(seed) {
  const run = createRun({ seed: seed * 7919 + 13 });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 50;
  tel.tick(0.5);
  let guard = 600;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC && guard-- > 0) {
    const q = run.state.question;
    const i = Math.floor(rng() * q.options.length);
    tel.act(() => run.answer(i));
    tel.tick(0.12 + rng() * 0.3);
  }
  return finish(tel, run);
}

// noinput：只推时间，测自动推进/超时基线
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = GAME.TIME_PER_QUESTION + 6;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'traffic-commute',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
