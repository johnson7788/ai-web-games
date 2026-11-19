// SWAY BLOCKS · 自对弈（纯逻辑，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// greedy 串行 L1→L2→L3（推进率门槛要求到达第 3 关）；random / noinput 只打 L1 作基线。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: carried?.simTime ?? 0,
    firstInputAt: carried?.firstInputAt ?? null,
    firstSuccessAt: carried?.firstSuccessAt ?? null,
    deaths: carried?.deaths ?? 0,
    actions: carried?.actions ?? 0,
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
  };
  tel.step = (dt) => {
    run.step(dt);
    tel.simTime += dt;
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lose') tel.deaths += 1;
    }
  };
  tel.act = (fn) => {
    const r = fn();
    if (r && r.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    return r;
  };
  return tel;
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
    inputLatencyMs: 0, // 纯 sim，无渲染输入延迟
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

// ---------------- greedy：完美时机松手，串行 L1→L2→L3 ----------------
const PERFECT_TIGHT = 0.03;

function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  const MAX_STEPS = 8000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase === 'swinging' && run.state.currentBlock && Math.abs(run.state.ropeAngle) < PERFECT_TIGHT) {
      tel.act(() => run.drop());
    }
    tel.step(1 / 60);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyOnce(lv, seed + lv, carried);
    last = finish(tel, run);
    carried = tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：随机间隔松手，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let nextDrop = 0.5 + rng() * 1.5;
  const MAX_STEPS = 8000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase === 'swinging' && run.state.currentBlock && tel.simTime >= nextDrop) {
      tel.act(() => run.drop());
      nextDrop = tel.simTime + 0.4 + rng() * 1.2;
    }
    tel.step(1 / 60);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间（自动松手兜底 → 测死时间基线） ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 8000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    tel.step(1 / 60);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'sway-blocks',
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
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
