// FOOD CHAIN · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, FISH } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：只吃安全食物 + 躲大鱼 ----------
const FLEE_RANGE = 280;

function greedyTarget(run) {
  const p = run.player;
  run._ft = (run._ft || 0) + 1;

  // 粘性逃跑：短时间承诺一个方向，避免抖动导致被逼进墙角
  if (run._fleeTarget && run._ft < run._fleeUntil) return run._fleeTarget;

  // 找最近的更大鱼（威胁）
  let threat = null;
  let td = Infinity;
  for (const f of run.fish) {
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (f.r > p.r && d < FLEE_RANGE && d < td) { td = d; threat = f; }
  }

  if (threat) {
    const d = td || 1;
    const ax = (p.x - threat.x) / d;
    const ay = (p.y - threat.y) / d;
    // 朝远离威胁 + 朝场地中心偏移，避免被逼进墙角
    const cx = (WORLD.WIDTH / 2 - p.x) / (WORLD.WIDTH / 2);
    const cy = (WORLD.HEIGHT / 2 - p.y) / (WORLD.HEIGHT / 2);
    let vx = ax * 0.6 + cx * 0.75;
    let vy = ay * 0.6 + cy * 0.75;
    const m = Math.hypot(vx, vy) || 1;
    const t = {
      x: Math.max(80, Math.min(WORLD.WIDTH - 80, p.x + (vx / m) * 560)),
      y: Math.max(80, Math.min(WORLD.HEIGHT - 80, p.y + (vy / m) * 560)),
    };
    run._fleeTarget = t;
    run._fleeUntil = run._ft + 14;
    return t;
  }
  run._fleeTarget = null;

  // 优先吃可吞的非毒鱼（越值钱越近越好）
  let bestFish = null;
  let bestScore = Infinity;
  for (const f of run.fish) {
    if (f.toxic) continue;
    if (f.r <= p.r * FISH.EAT_RATIO) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      const score = d - (f.stage + 1) * 24;
      if (score < bestScore) { bestScore = score; bestFish = { x: f.x, y: f.y }; }
    }
  }
  if (bestFish) return bestFish;

  let bestFood = null;
  let bf = Infinity;
  for (const fd of run.foods) {
    const d = Math.hypot(fd.x - p.x, fd.y - p.y);
    if (d < bf) { bf = d; bestFood = { x: fd.x, y: fd.y }; }
  }
  if (bestFood) return bestFood;
  return { x: p.x, y: p.y };
}

function greedyInput(run) {
  const p = run.player;
  const target = greedyTarget(run);
  const finger = run._botFinger || { x: p.x, y: p.y };
  const dx = target.x - finger.x;
  const dy = target.y - finger.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(9, d);
  const ux = d > 1 ? dx / d : 0;
  const uy = d > 1 ? dy / d : 0;
  const tremor = (run.rng() - 0.5) * 6;
  const fx = Math.max(0, Math.min(WORLD.WIDTH, finger.x + ux * step + tremor));
  const fy = Math.max(0, Math.min(WORLD.HEIGHT, finger.y + uy * step + tremor));
  run._botFinger = { x: fx, y: fy };
  return { steerX: fx, steerY: fy };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let tx = WORLD.WIDTH / 2;
  let ty = WORLD.HEIGHT / 2;
  let tick = 0;
  return () => {
    tick += 1;
    if (tick % 30 === 0) {
      tx = rng() * WORLD.WIDTH;
      ty = rng() * WORLD.HEIGHT;
    }
    return { steerX: tx, steerY: ty };
  };
}

function noinput() {
  return { steerX: null, steerY: null };
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
  let prevX = null;
  let prevY = null;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerX != null || input.steerY != null)) firstInputSec = sec;

    const steerChanged = input.steerX != null && (prevX == null || Math.abs(input.steerX - prevX) > 2 || Math.abs(input.steerY - prevY) > 2);
    if (steerChanged) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = input.steerX == null && input.steerY == null && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevX = input.steerX;
    prevY = input.steerY;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'evolve' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: (run.stats.maxStage ?? run.player.stage) + 1,
    completed: run.phase !== 'dead',
    maxStage: run.stats.maxStage ?? run.player.stage,
    maxMass: Math.round(run.stats.maxMass ?? 0),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(stage=${r.maxStage},mass=${r.maxMass},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
