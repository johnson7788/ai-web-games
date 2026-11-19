// tools/selfplay.mjs — SPACE PINBALL · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测写入 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 240;
const INPUT_LATENCY_MS = 90;

const SUCCESS_EVENTS = ['bumperHit', 'reactorHit', 'asteroidHit', 'starCollect', 'shardHit', 'buttonHit', 'gateFlip', 'launchpad', 'reactorOverdrive'];

// ---------- 策略 ----------
function greedyInput(run) {
  const ready = run.balls.find((b) => b.state === 'ready');
  let launch = false;
  if (ready) {
    if (run.launchCharge < 0.95) launch = true;
    else launch = false;
  }

  if (run._flipL == null) run._flipL = 0;
  if (run._flipR == null) run._flipR = 0;

  for (const b of run.balls) {
    if (b.state !== 'live') continue;
    if (b.y > 500 && b.vy > 20) {
      if (b.x < 620) run._flipL = 5;
      else if (b.x > 660) run._flipR = 5;
      else { run._flipL = 5; run._flipR = 5; }
    }
  }

  const left = run._flipL > 0;
  const right = run._flipR > 0;
  run._flipL = Math.max(0, run._flipL - 1);
  run._flipR = Math.max(0, run._flipR - 1);

  let nudge = 0;
  for (const b of run.balls) {
    if (b.state !== 'live') continue;
    if (b.y > 380 && Math.hypot(b.vx, b.vy) < 30) nudge = b.x < 640 ? 1 : -1;
  }
  return { left, right, launch, nudge };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return () => ({
    left: rng() < 0.15,
    right: rng() < 0.15,
    launch: rng() < 0.3,
    nudge: rng() < 0.05 ? (rng() < 0.5 ? -1 : 1) : 0,
  });
}

function noinput() {
  return { left: false, right: false, launch: false, nudge: 0 };
}

// ---------- 跑一局 ----------
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
  let prev = { left: false, right: false, launch: false, nudge: 0 };

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const acted = input.left || input.right || input.launch || input.nudge;
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    const toggled = (!!input.left !== prev.left) || (!!input.right !== prev.right)
      || (!!input.launch !== prev.launch) || (input.nudge !== prev.nudge);
    if (toggled && acted) actions += 1;
    prev = { left: !!input.left, right: !!input.right, launch: !!input.launch, nudge: input.nudge ?? 0 };

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && SUCCESS_EVENTS.includes(e.type)) {
        firstSuccessSec = sec;
      }
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
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.waveReached,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ genre: 'arcade', runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: () => randomInput(), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.levelsReached},score=${r.score},dead=${r.deaths},dur=${r.durationSec}s,firstSuccess=${r.firstSuccessSec})`).join('  '));
