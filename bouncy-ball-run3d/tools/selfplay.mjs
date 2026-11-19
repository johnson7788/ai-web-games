// BOUNCY BALL RUN3D · 自对弈：Node 无头驱动 sim（无 DOM），
// greedy / random / noinput 三策略 → tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, greedyDir } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;

function makeTracker(policy, seed) {
  return {
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(['start']),
    eventTimes: [0],
  };
}

function runPolicy(policy, seed, maxSteps) {
  const run = createRun({ seed });
  const tr = makeTracker(policy, seed);
  let a = (seed * 7919 + 13) >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase !== 'playing') break;
    let rotate = 0;
    if (policy === 'greedy') rotate = greedyDir(run);
    else if (policy === 'random') {
      const r = rng();
      rotate = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
    }
    run.step({ rotate });
    tr.simTime += STEP;
    if (rotate !== 0) {
      tr.actions += 1;
      if (tr.firstInputAt === null) tr.firstInputAt = tr.simTime;
    }
    for (const e of run.drainEvents()) {
      tr.seen.add(e.type);
      tr.eventTimes.push(tr.simTime);
      if ((e.type === 'pass' || e.type === 'gem') && tr.firstSuccessAt === null) tr.firstSuccessAt = tr.simTime;
      if (e.type === 'die') tr.deaths += 1;
    }
  }

  const times = tr.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }

  return {
    id: `${policy}-1`,
    policy,
    seed,
    durationSec: Number(tr.simTime.toFixed(2)),
    firstInputSec: Number((tr.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tr.firstSuccessAt === null ? null : Number(tr.firstSuccessAt.toFixed(2)),
    deaths: tr.deaths,
    actions: tr.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tr.seen.size,
    levelsReached: Math.max(1, Math.ceil(run.state.floors / 10)),
    completed: run.state.phase === 'won',
  };
}

// greedy：跑到通关（第 30 层）或死；random/noinput：跑到死或时间上限。
const runs = [
  runPolicy('greedy', 3, 5400),   // 上限 90s
  runPolicy('random', 2, 1800),   // 上限 30s
  runPolicy('noinput', 3, 1200),  // 上限 20s
];

const payload = {
  game: 'bouncy-ball-run3d',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} ` +
    `floors~lv=${r.levelsReached} completed=${r.completed}`,
  );
}
