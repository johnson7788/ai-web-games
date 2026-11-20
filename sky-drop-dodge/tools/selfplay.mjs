// tools/selfplay.mjs — SKY DROP DODGE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, clamp } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：预测落点反向移动 + 关键时刻举伞 ----------
function widestGapX(run) {
  const gy = WORLD.GROUND_Y;
  const near = run.items
    .filter((it) => it.active && it.y > gy - 340)
    .map((it) => ({ x: it.x, r: it.r }))
    .sort((a, b) => a.x - b.x);
  let bestX = run.player.x;
  let bestW = -1;
  let prevEdge = 0;
  for (const t of near) {
    const gap = t.x - t.r - prevEdge;
    if (gap > bestW) { bestW = gap; bestX = (prevEdge + t.x - t.r) / 2; }
    prevEdge = Math.max(prevEdge, t.x + t.r);
  }
  if (WORLD.WIDTH - prevEdge > bestW) {
    bestW = WORLD.WIDTH - prevEdge;
    bestX = (prevEdge + WORLD.WIDTH) / 2;
  }
  return clamp(bestX, 40, WORLD.WIDTH - 40);
}

function greedyInput(run) {
  const p = run.player;
  const gy = WORLD.GROUND_Y;
  const threats = run.items.filter((it) => it.active && it.y > gy - 320 && it.y < gy);

  let danger = null;
  for (const t of threats) {
    const dx = Math.abs(t.x - p.x);
    if (dx < (t.isBig ? 140 : 95)) {
      if (!danger || dx < Math.abs(danger.x - p.x)) danger = t;
    }
  }

  let block = false;
  if (danger) {
    if (danger.isBig && p.shield > 0 && Math.abs(danger.x - p.x) < 120 && danger.y > gy - 140) block = true;
    else if (!danger.isBig && p.shield >= 2 && Math.abs(danger.x - p.x) < 70 && danger.y > gy - 120) block = true;
  }

  let targetX;
  if (danger) {
    const dir = p.x >= danger.x ? 1 : -1;
    targetX = clamp(p.x + dir * 320, 40, WORLD.WIDTH - 40);
  } else {
    targetX = widestGapX(run);
  }

  run._botTick = (run._botTick ?? 0) + 1;
  if (run._botTick % 12 === 0) {
    const noise = (run.rng() - 0.5) * 44;
    run._botAim = clamp(targetX + noise, 0, WORLD.WIDTH);
  }
  const aim = run._botAim ?? targetX;

  // 真实拖动模型：手指以有限速度追目标 + 生理震颤（连续微调，不 settle-and-hold）
  const finger = run._botFinger ?? p.x;
  const toward = clamp(aim - finger, -9, 9);
  const jitter = (run._botTick % 2 === 0 ? 3 : -3);
  const steerX = clamp(finger + (Math.abs(aim - finger) > 12 ? toward : jitter), 0, WORLD.WIDTH);
  run._botFinger = steerX;
  return { steerX, block };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let randX = 640;
  return (run, tick) => {
    if (tick % 24 === 0) randX = rng() * WORLD.WIDTH;
    return { steerX: randX, block: rng() < 0.2 };
  };
}

function noinput() {
  return { steerX: null, block: false };
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
  let prevBlock = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerX != null || input.block)) firstInputSec = sec;

    const steerChanged = input.steerX != null && (prevSteer == null || Math.abs(input.steerX - prevSteer) > 2);
    const blockToggled = !!input.block !== prevBlock;
    if (steerChanged || blockToggled) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = !input.block && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevSteer = input.steerX;
    prevBlock = !!input.block;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'waveEnter' && e.wave >= 2 && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.waveReached || run.waveIndex || 1,
    completed: run.phase === 'won',
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
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
