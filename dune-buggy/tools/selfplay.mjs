// DUNE BUGGY · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { clamp, STAGE } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const SEG_LEN = STAGE.SEG_LEN;
const MAX_SEC = 220; // 单局上限
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
function maxAbsCurve(run, meters) {
  const base = Math.floor(run.position / SEG_LEN);
  const n = Math.max(1, Math.ceil(meters / SEG_LEN));
  let m = 0;
  for (let i = 0; i < n; i += 1) {
    const seg = run.segments[(base + i) % run.segments.length];
    if (Math.abs(seg.curve) > m) m = Math.abs(seg.curve);
  }
  return m;
}

function greedyInput(run, tick) {
  // 目标：骑中心沙脊（playerX→0）
  const desired = clamp((0 - run.playerX) * 5, -1, 1);
  run._finger = run._finger ?? 0;
  run._finger += clamp(desired - run._finger, -0.16, 0.16);
  if (Math.abs(desired - run._finger) < 0.14) run._finger += (run.rng() - 0.5) * 0.12; // 生理震颤
  run._finger = clamp(run._finger, -1, 1);

  const steer = run._finger;
  const throttle = 1;
  let brake = 0;
  if (Math.abs(run.playerX) > 0.85 && run.speed > 22) brake = 0.5;       // 快出界时减速
  const lookahead = maxAbsCurve(run, 46);
  if (lookahead > 0.05 && run.speed > 24) brake = Math.max(brake, 0.6);  // 弯前减速
  const tune = (tick === 0 || tick === 30); // 开局切换两次胎压（产生 tune 事件）
  return { steer, throttle, brake, tune };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let steer = 0;
  let throttle = 0;
  return (run, tick) => {
    if (tick % 24 === 0) steer = rng() * 2 - 1;
    if (tick % 18 === 0) throttle = rng() < 0.7 ? 1 : 0;
    const brake = rng() < 0.04 ? 1 : 0;
    const tune = rng() < 0.02;
    return { steer, throttle, brake, tune };
  };
}

function noinput() {
  return { steer: 0, throttle: 0, brake: 0, tune: false };
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
  let prevSteer = 0;
  let prevThrottle = 0;
  let prevBrake = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (Math.abs(input.steer || 0) > 0 || input.throttle > 0 || input.brake > 0)) {
      firstInputSec = sec;
    }

    const steerChanged = Math.abs((input.steer || 0) - prevSteer) > 0.01;
    const throttleChanged = (input.throttle > 0) !== (prevThrottle > 0);
    const brakeChanged = (input.brake > 0) !== (prevBrake > 0);
    const hasAction = steerChanged || throttleChanged || brakeChanged || !!input.tune;
    if (hasAction) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !hasAction && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevSteer = input.steer || 0;
    prevThrottle = input.throttle > 0;
    prevBrake = input.brake > 0;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'stageClear' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.maxStage || run.stage || 1,
    completed: run.phase === 'won',
    stageReached: run.stats.maxStage || run.stage || 1,
    fastestStage: Math.round((run.stats.fastestStage || 0) * 100) / 100,
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'dune-buggy', genre: 'racing', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(stage=${r.stageReached},dead=${r.deaths},dur=${r.durationSec}s,success=${r.firstSuccessSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
