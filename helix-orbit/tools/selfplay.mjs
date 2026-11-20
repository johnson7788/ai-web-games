// HELIX ORBIT · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, greedyRotate } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限 5 分钟，防贪心 bot 永续
const INPUT_LATENCY_MS = 90;

function clamp01(v) {
  return Math.max(-1, Math.min(1, v));
}

// ---------- 策略 ----------
function greedyInput(run) {
  const base = greedyRotate(run);
  // 真实操作模型：朝目标连续微调 + 生理震颤（即使已对准也在微调，不是 settle-and-hold）
  const tremor = (run.rng() - 0.5) * 0.7;
  let r = base;
  if (Math.abs(base) < 0.05) r = tremor;
  else r = base + tremor;
  return { rotate: clamp01(r) };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let target = 0;
  return (run, tick) => {
    if (tick % 30 === 0) target = (rng() - 0.5) * 2;
    const tremor = (rng() - 0.5) * 0.4;
    return { rotate: clamp01(target + tremor) };
  };
}

function noinput() {
  return { rotate: 0 };
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

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || { rotate: 0 };
    run.step(input);
    const sec = run.time;

    const acting = Math.abs(input.rotate) > 0.02;
    if (firstInputSec < 0 && acting) firstInputSec = sec;
    if (acting) actions += 1;
    if (firstSuccessSec < 0 && run.score > 0) firstSuccessSec = sec;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入动作、也无任何游戏反馈事件
    const idle = !acting && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
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
    levelsReached: run.stats.depth || run.currentLayer || 1,
    completed: run.phase !== 'dead',
    maxDepth: Math.floor(run.currentLayer),
    maxScore: run.score,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
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
console.log('strategies:', records.map((r) => `${r.policy}(depth=${r.maxDepth},score=${r.maxScore},dead=${r.deaths},dur=${r.durationSec}s,actions=${r.actionsPerMin}/min,unique=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
