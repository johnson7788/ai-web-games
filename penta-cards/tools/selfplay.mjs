// tools/selfplay.mjs — PENTA CARDS · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
// schema 与 fun-report 硬校验一致（{runs:[...]}）；遥测规则见 REBUILD-BRIEF §3。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, step, drainEvents, greedyDecide } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { TIME_PER_STEP } from '../config/rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_TICKS = 40000;
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------

function randomDecide(run, pending) {
  const seat = run.seats[0];
  const r = run.rng;
  if (pending.kind === 'turnStart') {
    const opts = pending.options;
    if (opts.stargaze && r() < 0.25) return { action: 'stargaze' };
    if (opts.swap && r() < 0.15) return { action: 'swap', tile: seat.holds[Math.floor(r() * seat.holds.length)] };
    return { action: 'draw' };
  }
  if (pending.kind === 'discard') {
    if (pending.options.canHu) return { action: 'hu' };
    if (pending.options.canGang && r() < 0.5) return { action: 'gang', tile: pending.options.gangPai[0] };
    return { action: 'discard', tile: seat.holds[Math.floor(r() * seat.holds.length)] };
  }
  if (pending.kind === 'claim') {
    const o = pending.options;
    if (o.hu && r() < 0.5) return { action: 'hu' };
    if (o.gang && r() < 0.2) return { action: 'gang', tile: o.gangPai[0] };
    if (o.peng && r() < 0.4) return { action: 'peng' };
    return { action: 'pass' };
  }
  return { action: 'pass' };
}

const STRATEGIES = [
  { name: 'greedy', seed: 123, inputFor: (run, p) => greedyDecide(run, p) },
  { name: 'random', seed: 456, inputFor: (run, p) => randomDecide(run, p) },
  { name: 'noinput', seed: 789, inputFor: () => null },
];

// ---------- 跑一局 ----------

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleSec = 0;
  let deaths = 0;
  let maxRound = 1;

  for (let tick = 0; tick < MAX_TICKS && run.phase === 'playing'; tick += 1) {
    const pending = run.pending;
    const isPlayerTurn = pending && pending.seat === 0;
    const input = isPlayerTurn ? inputFor(run, pending) : null;

    if (isPlayerTurn) {
      if (input && input.action) {
        actions += 1;
        if (firstInputSec < 0) firstInputSec = run.time;
      }
    }
    step(run, input);

    const events = drainEvents(run);
    if (isPlayerTurn && !(input && input.action) && events.length === 0) {
      idleSec += TIME_PER_STEP;
    } else if (!isPlayerTurn && events.length === 0) {
      idleSec += TIME_PER_STEP;
    }

    for (const e of events) {
      eventKinds.add(e.type);
      if (e.type === 'win' && firstSuccessSec == null) firstSuccessSec = e.time;
      if (e.type === 'lose') deaths += 1;
      if (lastEventSec != null) {
        const gap = e.time - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = e.time;
    }
    maxRound = Math.max(maxRound, run.round);
  }

  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(run.time * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec == null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths,
    idleSec: Math.round(idleSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: Math.min(12, maxRound),
    completed: run.phase === 'sessionEnd',
    roundsWon: run.stats.roundsWon,
    roundsLost: run.stats.roundsLost,
  };
}

// ---------- 写文件 ----------

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'penta-cards', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
  return records;
}

const records = STRATEGIES.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(round=${r.levelsReached},won=${r.roundsWon},lost=${r.roundsLost},firstWin=${r.firstSuccessSec}s,dur=${r.durationSec}s,actions=${r.actions})`).join('  '));
console.log('autoplay.json records:', all.length);
