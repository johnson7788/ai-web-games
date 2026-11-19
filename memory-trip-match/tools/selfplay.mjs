// MEMORY TRIP MATCH · 自对弈（Node 无头，直接 import sim，无 DOM）。
// 跑 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：串行打 L1→L2→L3，正确配对（推进率门槛要求到第 3 关）；
// random：乱翻，撞步数预算判负（死亡存在性）；noinput：只推时间（死时间基线）。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried, reached) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: reached,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    levelsReached: reached,
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

function solveOnce(run, tel) {
  // 预览结束后按符号正确配对（含岩石敲裂）
  while (run.state.phase === 'preview') tel.tick(1 / 60);
  const bySymbol = new Map();
  for (const c of run.state.cards) {
    if (c.solved) continue;
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
    bySymbol.get(c.symbol).push(c.id);
  }
  for (const [, ids] of bySymbol) {
    for (const id of ids) {
      let guard = 0;
      while (guard++ < 4) {
        const card = run.state.cards[id];
        if (card.revealed || card.solved) break;
        const r = tel.act(() => run.flip(id));
        if (!r.ok) break;
        if (run.state.phase !== 'playing') return;
      }
      if (run.state.phase !== 'playing') return;
    }
  }
}

// greedy：串行 L1→L2→L3
function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    const tel = makeTracker(run, 'greedy', seed, carried, lv + 1);
    solveOnce(run, tel);
    last = finish(tel, run);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

// random：只翻「当前可翻」的卡（乱配对），步数必然超预算判负（死亡存在性证据）
function random(seed) {
  const rng = mulberry32(seed * 7919 + 13);
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv * 3 });
    const tel = makeTracker(run, 'random', seed, carried, lv + 1);
    while (run.state.phase === 'preview') tel.tick(1 / 60);
    const MAX_ITER = 4000;
    let iter = 0;
    while (run.state.phase === 'playing' && iter++ < MAX_ITER) {
      if (run.state.mismatchLock <= 0) {
        const cands = run.state.cards.filter((c) => !c.solved && !c.revealed);
        if (cands.length) {
          const id = cands[Math.floor(rng() * cands.length)].id;
          tel.act(() => run.flip(id));
        } else if (run.state.hintsLeft > 0 && rng() < 0.02) {
          tel.act(() => run.hint());
        } else {
          tel.tick(1 / 60);
        }
      } else {
        tel.tick(1 / 60);
      }
    }
    last = finish(tel, run);
    carried = last._tel;
    if (last.completed) { carried.level = lv + 2; continue; }
    break;
  }
  return last;
}

// noinput：只推时间
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed, null, 1);
  const MAX_SEC = LEVELS[0].previewSec + 6;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'memory-trip-match',
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
    `actions=${r.actions} deaths=${r.deaths} reached=${r.levelsReached} completed=${r.completed}`,
  );
}
