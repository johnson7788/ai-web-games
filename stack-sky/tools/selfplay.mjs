// STACK SKY · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 150;            // 单局上限 2.5 分钟
const INPUT_LATENCY_MS = 90;    // 遥测常量：输入→sim 延迟

// ---------- 策略：inputFor(run, tick) → { drop } ----------
// greedy：块中心过塔心即停（带 ~15ms 人类反应延迟，高速下更难对齐，模拟真实操作）
const REACTION_SEC = 0.015;
function greedyInput(run) {
  const m = run.moving;
  const top = run.top;
  const reactionPx = m.speed * REACTION_SEC;
  if (m.dir === 1 && m.x >= top.x + reactionPx) return { drop: true };
  if (m.dir === -1 && m.x <= top.x - reactionPx) return { drop: true };
  return { drop: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return () => ({ drop: rng() < 0.05 });
}

function noinput() {
  return { drop: false };
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
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && input.drop) firstInputSec = sec;
    if (input.drop) actions += 1;

    const tickEvents = run.drainEvents();
    // 空转 = 这一秒既没输入动作、也没收到任何游戏反馈事件
    const idle = !input.drop && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'drop' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.segment || run.segment || 1,
    completed: run.phase !== 'dead' && run.segment >= 12,
    height: Math.floor(run.score),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件（整批替换，保持 fun-report 的 {runs:[...]} schema） ----------
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
console.log('strategies:', records.map((r) => `${r.policy}(h=${r.height},seg=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,act=${r.actions}/min=${r.actionsPerMin})`).join('  '));
console.log('autoplay.json records:', all.length);
