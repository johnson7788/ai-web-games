// MINI PINBALL · 自对弈（Node 无头，直接 import sim，无 DOM）。
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：搜索「当前破坏最多方块」的发射角，串行打 L1→L2→L3（推进率要求到达第 3 关）。
import { createRun, mulberry32, trialLaunch } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.levelIndex + 1,
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
      if (res) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(STEP);
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

// 搜索当前状态下「单发破坏最多方块」的发射角（纯确定性）
function pickBestAngle(state) {
  const N = 180;
  let bestAngle = -Math.PI / 2;
  let bestScore = -1;
  for (let i = 0; i < N; i += 1) {
    const ang = -Math.PI + (i / N) * Math.PI * 2;
    const t = trialLaunch(state, ang);
    const score = t.destroyed * 1000 + (t.cleared ? 500 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = ang;
    }
  }
  return bestAngle;
}

function solveLevel(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  let guard = 40000;
  while (run.state.phase !== 'won' && guard-- > 0) {
    if (run.state.phase === 'aiming') {
      const ang = pickBestAngle(run.state);
      if (!tel.act(() => run.launch(ang))) break;
    } else {
      tel.tick(STEP);
    }
  }
  return { res: finish(tel, run), tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { res, tel } = solveLevel(lv, seed + lv, carried);
    last = res;
    carried = tel;
    if (!res.completed) break;
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 45;
  while (run.state.phase !== 'won' && tel.simTime < MAX_SEC) {
    if (run.state.phase === 'aiming') {
      const up = rng() < 0.6;
      const ang = up
        ? -Math.PI * (0.15 + rng() * 0.7)   // 向上半圆：打方块 / 弹射
        : Math.PI * (0.15 + rng() * 0.7);   // 向下半圆：快速落底 → 高频输入
      tel.act(() => run.launch(ang));
    } else {
      tel.tick(STEP);
    }
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (tel.simTime < MAX_SEC) tel.tick(STEP);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'mini-pinball',
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
    `actions=${r.actions} apm=${Math.round(r.actions / (r.durationSec / 60))} deaths=${r.deaths} ` +
    `events=${r.uniqueEvents} maxGap=${r.maxEventGapSec}s levels=${r.levelsReached} completed=${r.completed}`,
  );
}
