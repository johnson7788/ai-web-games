// SNAKE GLOW CLASSIC · 自对弈（无头，直接 import sim，不碰 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy = 可达空间 + 距目标最近；random = 乱转向；noinput = 什么都不做（基线，会自动撞墙）。
// actions 记「被接受的网格步」：greedy/random 每步都由 bot 选向；noinput 无主动输入记 0。
import { createRun, stepRun, drainEvents, mulberry32 } from '../src/game/sim.js';
import { greedyDir, greedyBoost } from '../src/game/ai.js';
import { RUN } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function finish(tel, run, policy) {
  const times = [...tel.eventTimes].sort((a, b) => a - b);
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((policy === 'noinput' ? 0 : (tel.firstInputAt ?? 0)).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim，无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: policy === 'noinput' ? 0 : run.moves,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.stage,
    completed: run.phase === 'won',
  };
}

function runOne(policy, seed) {
  const run = createRun({ seed });
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    seen: new Set(),
    eventTimes: [0],
  };
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  const step = (input) => {
    stepRun(run, input, 1 / 60);
    tel.simTime += 1 / 60;
    for (const e of drainEvents(run)) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'food' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'death') tel.deaths += 1;
    }
    if (policy !== 'noinput' && tel.firstInputAt === null && run.moves > 0) tel.firstInputAt = tel.simTime;
  };

  const MAX = RUN.TIME_LIMIT_SEC + 15;
  while (run.phase === 'playing' && tel.simTime < MAX) {
    if (policy === 'noinput') {
      step({ dir: null, boost: false });
    } else if (policy === 'random') {
      const roll = rng();
      let d;
      if (roll < 0.25) d = { x: 1, y: 0 };
      else if (roll < 0.5) d = { x: -1, y: 0 };
      else if (roll < 0.75) d = { x: 0, y: 1 };
      else d = { x: 0, y: -1 };
      step({ dir: d, boost: rng() < 0.12 });
    } else {
      step({ dir: greedyDir(run), boost: greedyBoost(run) });
    }
  }

  return finish(tel, run, policy);
}

const runs = [runOne('greedy', 3), runOne('random', 2), runOne('noinput', 5)];
const payload = {
  game: 'snake-glow-classic',
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
    `maxGap=${r.maxEventGapSec}s level=${r.levelsReached} completed=${r.completed}`,
  );
}
