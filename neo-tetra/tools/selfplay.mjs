// NEO TETRA · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, dropResult, clearableRows, clearRows, placeCells } from '../src/game/sim.js';
import { aggregateHeight, countHoles, bumpiness } from '../src/game/board.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：枚举所有旋转×列，代价函数选最优落点 ----------
function costOf(board, cleared) {
  const agg = aggregateHeight(board);
  const holes = countHoles(board);
  const bump = bumpiness(board);
  const n = cleared.length;
  return agg * 0.51 + holes * 0.76 + bump * 0.18 - n * 10 - (n >= 4 ? 15 : 0);
}

function bestPlacement(run, type) {
  let best = null;
  for (let rot = 0; rot < 4; rot += 1) {
    for (let x = 0; x < 10; x += 1) {
      const d = dropResult(run.board, type, rot, x);
      if (!d.ok) continue;
      const after = placeCells(run.board, d.cells, 1);
      const cleared = clearableRows(after, { narrow: run.narrow });
      const final = clearRows(after, cleared);
      const c = costOf(final, cleared);
      if (!best || c < best.c) best = { rot, x, c };
    }
  }
  return best;
}

function greedyInput(run) {
  const a = run.active;
  if (!a) return {};
  const plan = bestPlacement(run, a.type);
  if (!plan) return { hardDrop: true };
  const input = {};
  if (a.rot !== plan.rot) {
    const cw = (plan.rot - a.rot + 4) % 4;
    input[cw <= 2 ? 'rotateCW' : 'rotateCCW'] = true;
  } else if (a.x < plan.x) {
    input.moveRight = true;
  } else if (a.x > plan.x) {
    input.moveLeft = true;
  } else {
    input.hardDrop = true;
  }
  return input;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    const r = rng();
    const input = {};
    if (r < 0.12) input.moveLeft = true;
    else if (r < 0.24) input.moveRight = true;
    else if (r < 0.36) input.rotateCW = true;
    else if (r < 0.44) input.rotateCCW = true;
    else if (r < 0.56) input.softDrop = true;
    else if (r < 0.66) input.hardDrop = true;
    else if (r < 0.70) input.hold = true;
    return input;
  };
}

function noinput() {
  return {};
}

function hasInput(input) {
  return input.moveLeft || input.moveRight || input.softDrop || input.rotateCW
    || input.rotateCCW || input.hardDrop || input.hold;
}

// ---------- 跑一局 ----------
function play(policy, inputFor, seed, maxSec) {
  const run = createRun({ seed });
  const maxTicks = Math.round(maxSec / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && hasInput(input)) firstInputSec = sec;
    if (hasInput(input)) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !hasInput(input) && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'lineClear' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  return {
    id: `${policy}-${seed}`,
    policy,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.layerReached || run.layer || 1,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
    lines: run.lines,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'neo-tetra', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123, maxSec: 90 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456, maxSec: 90 },
  { name: 'noinput', inputFor: noinput, seed: 789, maxSec: 90 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed, s.maxSec));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(layer=${r.levelsReached},lines=${r.lines},dead=${r.deaths},dur=${r.durationSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
