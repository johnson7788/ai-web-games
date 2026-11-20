// ABC POP · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, currentTarget } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { PLAY } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 120; // 单局上限 2 分钟
const INPUT_LATENCY_MS = 90; // 遥测常量

// ---------- 策略：inputFor(run, tick) → { tap: {x,y} | null } ----------
function greedyInput(run) {
  run._tapTimer = (run._tapTimer ?? 0) + STEP;
  if (run._tapTimer < 0.42) return { tap: null };
  run._tapTimer = 0;

  const target = currentTarget(run);
  let desired = target.forms[0];
  if (run.round === 1) {
    for (const f of target.forms) {
      if (!run.formsDone.has(f)) { desired = f; break; }
    }
  }
  const b = run.bubbles.find((x) => x.letter === desired);
  if (!b) return { tap: null };
  // 真实手指模型：轻微震颤（不会像素级精准）
  const jx = (run.rng() - 0.5) * 8;
  const jy = (run.rng() - 0.5) * 8;
  return { tap: { x: b.x + jx, y: b.y + jy } };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let timer = 0;
  return (run) => {
    timer += STEP;
    if (timer < 0.55) return { tap: null };
    timer = 0;
    return {
      tap: {
        x: rng() * WORLD.WIDTH,
        y: PLAY.TOP + 20 + rng() * (PLAY.BOTTOM - PLAY.TOP - 40),
      },
    };
  };
}

function noinput() {
  return { tap: null };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  run.drainEvents();
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
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && input.tap) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    const hitBubble = tickEvents.some((e) => e.type === 'bubblePop' || e.type === 'bubbleMiss');
    if (input.tap && hitBubble) actions += 1;

    // 空转 = 这一 tick 既无输入、也无任何事件（drift 心跳在，泡泡漂移不算空转）
    const idle = !input.tap && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'bubblePop' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    deaths: 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase === 'cleared',
    maxStreak: run.maxStreak,
    score: run.score,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'sim', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(level=${r.levelsReached},success=${r.firstSuccessSec}s,actions=${r.actionsPerMin}/min,dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
