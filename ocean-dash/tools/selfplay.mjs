// tools/selfplay.mjs — OCEAN DASH · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, gapAhead } from '../src/game/sim.js';
import { WORLD, clamp, schoolHeight } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：预判障碍 + 走气流 + 窄缝收拢 + 跃面滑翔 ----------
function greedyInput(run) {
  const gap = gapAhead(run.obstacles, run.dist, 320);
  const targetY = clamp(gap.y, WORLD.WATER_MIN, WORLD.WATER_MAX);

  const spreadH = schoolHeight(run.fish, false);
  const nearSurface = gap.y < 250 && gap.h > 0;
  const narrow = !nearSurface && gap.h > 0 && gap.h < spreadH + 6;
  const gather = narrow && run.mode === 'swim';
  const jump = nearSurface && run.mode === 'swim';
  const glide = run.mode !== 'swim' || nearSurface;

  // 真实微调 + 生理震颤（手指从不是像素级静止的；窄缝时更稳，减少抖动）
  run._botTick = (run._botTick ?? 0) + 1;
  if (run._botTick % 10 === 0) {
    const aimNoise = narrow ? 6 : 30;
    run._botAim = clamp(targetY + (run.rng() - 0.5) * aimNoise, WORLD.WATER_MIN, WORLD.WATER_MAX);
  }
  const aim = run._botAim ?? targetY;
  const finger = run._botFinger ?? run.player.y;
  const toward = clamp(aim - finger, -10, 10);
  const tremorAmp = narrow ? 3 : 7;
  let delta = Math.abs(aim - finger) > 10 ? toward : (run.rng() - 0.5) * tremorAmp;
  if (Math.abs(delta) < 2.5) delta = delta >= 0 ? 2.5 : -2.5; // 连续微调，从不静止
  const steerY = clamp(finger + delta, WORLD.WATER_MIN, WORLD.WATER_MAX);
  run._botFinger = steerY;

  return { steerY, gather, jump, glide };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let randY = 400;
  return (run, tick) => {
    if (tick % 30 === 0) randY = 200 + rng() * 420;
    const gather = rng() < 0.08;
    const jump = rng() < 0.03;
    return { steerY: randY, gather, jump, glide: jump || rng() < 0.02 };
  };
}

function noinput() {
  return { steerY: null, gather: false, jump: false, glide: false };
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
  let prevSteer = null;
  let prevGather = false;
  let prevJump = false;
  let prevGlide = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerY != null || input.gather || input.jump || input.glide)) firstInputSec = sec;

    const steerChanged = input.steerY != null && (prevSteer == null || Math.abs(input.steerY - prevSteer) > 2);
    const gatherToggled = !!input.gather !== prevGather;
    const jumpToggled = !!input.jump !== prevJump;
    const glideToggled = !!input.glide !== prevGlide;
    if (steerChanged || gatherToggled || jumpToggled || glideToggled) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = !input.gather && !input.jump && !input.glide && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevSteer = input.steerY;
    prevGather = !!input.gather;
    prevJump = !!input.jump;
    prevGlide = !!input.glide;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'segmentClear' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gapSec = sec - lastEventSec;
        if (gapSec > maxEventGap) maxEventGap = gapSec;
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
    levelsReached: run.stats.segmentReached,
    completed: run.phase === 'completed',
    segmentReached: run.stats.segmentReached,
    lastRank: run.stats.lastRank,
    fish: run.fish,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'action', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(seg=${r.segmentReached},rank=${r.lastRank},dead=${r.deaths},dur=${r.durationSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
