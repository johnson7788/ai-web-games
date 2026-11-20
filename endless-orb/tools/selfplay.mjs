// ENDLESS ORB · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, PHOTON, slotHalf, angDist } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 240;
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
// 安全判定：预测「光子到达核心边缘」那一刻，是否还有已钉光子挡在发射口正对的底部窗口内。
function safeToFire(run, safetyFactor) {
  const core = run.cores[0];
  const pr = run.nextHeavy ? PHOTON.HEAVY_R : PHOTON.R;
  const T = Math.max(0.01, (WORLD.PHOTON_START_Y - (core.y + core.R + pr)) / PHOTON.SPEED);
  const rotArrive = core.rotation + core.omega * T;
  for (const p of run.pinned) {
    const thArrive = rotArrive + p.slot;
    const window = (slotHalf(pr, core.R) + slotHalf(p.r, core.R)) * safetyFactor;
    if (Math.abs(angDist(thArrive, Math.PI / 2)) < window) return false;
  }
  return true;
}

function greedyInput(run) {
  if (run.photon) return { fire: false };
  if (run.pinned.length === 0) return { fire: true };
  const ring = run.ring;
  // 越往后越激进：前期稳钉保过第 3 环，后期窗口收紧自然失误（保证难度曲线与死亡存在性）
  const safetyFactor = ring <= 3 ? 1.6 : ring <= 6 ? 1.2 : 0.85;
  return { fire: safeToFire(run, safetyFactor) };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    if (run.photon) return { fire: false };
    return { fire: rng() < 0.16 };
  };
}

function noinput() {
  return { fire: false };
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
    const input = inputFor(run) || {};
    const fired = !!input.fire;
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && fired) firstInputSec = sec;
    if (fired) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !fired && tickEvents.length === 0;
    if (idle) idleTicks += 1;

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
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.ringReached || run.ring || 1,
    completed: run.phase !== 'dead',
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(ring=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,succ=${r.firstSuccessSec})`).join('  '));
console.log('autoplay.json records:', all.length);
