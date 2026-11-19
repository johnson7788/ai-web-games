#!/usr/bin/env node
// tools/selfplay.mjs — BRAIN CHICKEN RUN · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function greedyInput(run) {
  const g = (run._greedy ??= { h: 0.5 });
  let target = 0.5;
  if (run.question && !run.question.answered) target = run.question.answer ? 0 : 1;
  g.h = clamp(g.h + (target - g.h) * 0.4 + (run.rng() - 0.5) * 0.5, 0, 1);

  let choose = null;
  if (run.question && !run.question.answered) {
    if (run.question.timer <= run.question.answerTime - 0.8) {
      choose = run.question.answer ? 'true' : 'false';
    }
  }
  return { hover: g.h, choose };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const g = { h: 0.5 };
  return (run) => {
    g.h = clamp(g.h + (rng() - 0.5) * 0.6, 0, 1);
    let choose = null;
    if (run.question && !run.question.answered) {
      if (run.question.timer <= run.question.answerTime - 1.2) {
        choose = rng() < 0.5 ? 'true' : 'false';
      }
    }
    return { hover: g.h, choose };
  };
}

function noinput() {
  return { hover: null, choose: null };
}

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let prevHover = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step({ hover: input.hover, choose: input.choose });
    const sec = run.time;

    if (firstInputSec < 0 && (input.hover != null || input.choose != null)) firstInputSec = sec;

    const hoverChanged = input.hover != null && (prevHover == null || Math.abs(input.hover - prevHover) > 0.05);
    const committed = input.choose != null;
    if (hoverChanged || committed) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !hoverChanged && !committed && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevHover = input.hover;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'answerCorrect' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.stats.deaths,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase !== 'playing',
    wins: run.stats.wins,
  };
}

function main() {
  const runs = [
    play('greedy', greedyInput, 11),
    play('random', makeRandomStrategy(77), 22),
    play('noinput', noinput, 33),
  ];
  const data = { game: 'brain-chicken-run', genre: 'quiz', source: 'bot', runs };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`✓ ${runs.length} runs → ${OUT}`);
  for (const r of runs) {
    console.log(`  ${r.policy.padEnd(8)} dur=${String(r.durationSec).padEnd(6)} actions=${String(r.actions).padEnd(5)} firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} deaths=${r.deaths} lvl=${r.levelsReached} events=${r.uniqueEvents}`);
  }
}

main();
