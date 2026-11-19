// MEMORY FRIENDS MATCH · 自对弈（Node 无头，直接 import sim）
// 跑 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
import { createRun, mulberry32 } from '../src/game/sim.js';
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
  out._tel = tel;
  return out;
}

// greedy：完全按正确答案作答，串行打 L1→L2→L3（推进率要求到达第 3 关）
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  let usedHint = false;
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lose' && guard++ < 100000) {
    if (run.state.phase === 'memorize') {
      tel.act(() => run.memorizeDone());
    } else if (run.state.phase === 'question') {
      const q = run.state.question;
      if (q && !run.state.answered && run.state.transitionLeft <= 0) {
        if (!usedHint && q.options.length > 2) {
          tel.act(() => run.revealHint());
          usedHint = true;
        }
        tel.act(() => run.answer(q.options.indexOf(q.target)));
      }
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

// random：乱按作答，验证输入鲁棒（不计入成功率/推进率）
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lose' && guard++ < 100000 && tel.simTime < 120) {
    if (run.state.phase === 'memorize') {
      if (rng() < 0.05) tel.act(() => run.memorizeDone());
    } else if (run.state.phase === 'question') {
      const q = run.state.question;
      if (q && !run.state.answered && run.state.transitionLeft <= 0) {
        const roll = rng();
        if (roll < 0.8) tel.act(() => run.answer(Math.floor(rng() * q.options.length)));
        else if (q.options.length > 2) tel.act(() => run.revealHint());
      }
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进 / 死时间基线（会超时失败 = death）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lose' && guard++ < 200000) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'memory-friends-match',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
