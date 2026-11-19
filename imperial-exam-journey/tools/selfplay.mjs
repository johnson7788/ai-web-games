// IMPERIAL EXAM JOURNEY · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测写入 tools/fun/autoplay.json
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

// ---------- 策略 ----------
function greedyInput(run) {
  const cur = run.current;
  if (!cur || cur.resolved) return {};
  const g = (run._greedy ??= { riddleId: -1 });
  if (g.riddleId !== cur.riddleId) g.riddleId = cur.riddleId;
  const a = Array.from(cur.answer);
  const typed = Array.from(cur.input).length;
  if (typed < a.length) return { type: a[typed] };
  return { submit: true };
}

const RANDOM_CHARS = Array.from('甲乙丙丁天地日月山河水火风雷云雨雪金木土');
function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const g = { riddleId: -1, ticks: 0, hinted: false };
  return (run) => {
    const cur = run.current;
    if (!cur || cur.resolved) return {};
    if (g.riddleId !== cur.riddleId) {
      g.riddleId = cur.riddleId;
      g.ticks = 0;
      g.hinted = false;
    }
    g.ticks += 1;
    if (!g.hinted && run.hints > 0 && g.ticks === 8) {
      g.hinted = true;
      return { hint: true };
    }
    const typed = Array.from(cur.input).length;
    if (typed < 4) {
      if (g.ticks % 2 === 0) return { type: RANDOM_CHARS[Math.floor(rng() * RANDOM_CHARS.length)] };
      return {};
    }
    return { submit: true };
  };
}

function noinput() {
  return {};
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed, difficulty) {
  const run = createRun({ seed, difficulty });
  const maxTicks = Math.round(MAX_SEC / STEP);

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
    const input = inputFor(run) || {};
    run.step(input);
    const sec = run.time;

    const acted = input.type != null || input.submit === true || input.submitText != null || input.hint === true;
    if (firstInputSec < 0 && acted) firstInputSec = sec;
    if (acted) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

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
    difficulty,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.stats.losses,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase !== 'playing',
    wins: run.stats.wins,
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = {
    game: 'imperial-exam-journey',
    genre: 'puzzle',
    source: 'bot',
    runs: records,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123, difficulty: 1 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 456, difficulty: 2 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789, difficulty: 1 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed, s.difficulty));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},wins=${r.wins},deaths=${r.deaths},dur=${r.durationSec}s,act=${r.actions},idle=${r.idleSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
