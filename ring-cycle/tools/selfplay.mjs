// tools/selfplay.mjs — RING CYCLE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { BALL, clamp } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
function nextDyeTargetX(run) {
  let ring = null;
  let bestY = Infinity;
  for (const r of run.rings) {
    if (r.resolved || r.worldY <= run.depth) continue;
    if (r.worldY < bestY) { bestY = r.worldY; ring = r; }
  }
  if (!ring) return null;

  let bestX = null;
  let bestDist = Infinity;
  for (let i = 0; i < ring.cellsCount; i += 1) {
    if (ring.colors[i] !== run.dye) continue;
    const cx = (((ring.xOffset + i * ring.cellW + ring.cellW / 2) % WORLD.WIDTH) + WORLD.WIDTH) % WORLD.WIDTH;
    const d = Math.abs(cx - run.ball.x);
    const wrapD = Math.min(d, WORLD.WIDTH - d);
    if (wrapD < bestDist) { bestDist = wrapD; bestX = cx; }
  }
  return bestX;
}

function greedyInput(run) {
  const targetX = nextDyeTargetX(run);
  const aim = targetX == null ? run.ball.x : targetX;

  // 真实操作模型：每 tick 都朝目标持续微调（带小幅重瞄准噪声），不 settle-and-hold。
  // 糖球在持续下落，真人会不断修正水平位置；噪声让输入始终有动作、不产生假空转。
  const noise = (run.rng() - 0.5) * 18;
  const target = clamp(aim + noise, BALL.R, WORLD.WIDTH - BALL.R);

  const finger = run._botFinger ?? run.ball.x;
  const toward = clamp(target - finger, -14, 14);
  const steerX = clamp(finger + toward, BALL.R, WORLD.WIDTH - BALL.R);
  run._botFinger = steerX;
  return { steerX };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let randX = 640;
  return (run, tick) => {
    if (tick % 30 === 0) randX = BALL.R + rng() * (WORLD.WIDTH - BALL.R * 2);
    return { steerX: randX };
  };
}

function noinput() {
  return { steerX: null };
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
  let prevSteer = null;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && input.steerX != null) firstInputSec = sec;

    const steerChanged = input.steerX != null && (prevSteer == null || Math.abs(input.steerX - prevSteer) > 2);
    if (steerChanged) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevSteer = input.steerX;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'ringClear' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.band,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
    maxBand: run.stats.bandReached,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(band=${r.levelsReached},score=${r.score},dead=${r.deaths},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
