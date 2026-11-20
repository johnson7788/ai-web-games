// CONSTELLATION LINE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局 session
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { LEVEL_COUNT } from '../config/levels.js';
import { edgeKey } from '../src/game/euler.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;            // 单 session 上限 5 分钟
const INPUT_LATENCY_MS = 90;
const FIRST_INPUT_DELAY_TICKS = 5; // 极短观察期（读盘）

// ---------- 贪心策略：Hierholzer 解出每关轨迹，逐星点过去 ----------
function buildPlan(run) {
  const sols = run.solution();
  const plan = [];
  sols.forEach((s, i) => {
    if (i > 0) plan.push({ to: s.trail[0], switch: true }); // 切笔到另一子图起点
    for (let k = 1; k < s.trail.length; k += 1) plan.push({ from: s.trail[k - 1], to: s.trail[k] });
  });
  return plan;
}

function makeGreedy() {
  const state = { plan: [], idx: 0, levelIndex: -1 };
  return (run, tick) => {
    if (tick < FIRST_INPUT_DELAY_TICKS) return {};
    if (run.levelIndex !== state.levelIndex) {
      state.levelIndex = run.levelIndex;
      state.plan = buildPlan(run);
      state.idx = 0;
    }
    // 只推进已完成的步骤；失败（被流星挡）时停在原地重试，绝不 desync
    while (state.idx < state.plan.length) {
      const item = state.plan[state.idx];
      if (item.switch) {
        if (run.current === item.to) { state.idx += 1; continue; }
        return { to: item.to };
      }
      const key = edgeKey(item.from, item.to);
      if (run.usedEdges.has(key)) { state.idx += 1; continue; }
      if (run.meteorBlockedKey === key) return {}; // 等流星窗口（meteorSweep 事件保密度）
      return { to: item.to };
    }
    return {};
  };
}

function makeRandom(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    if (tick < 10) return {};
    if (tick % 8 !== 0) return {};
    const gi = Math.floor(rng() * run.nodes.length);
    return { to: gi };
  };
}

function noinput() {
  return {};
}

// ---------- 跑一个 session ----------
function play(name, inputFor, seed) {
  let run = createRun({ levelIndex: 0, seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let deaths = 0;
  let levelsReached = 1;
  let completed = false;
  let sessionDone = false;

  for (let tick = 0; tick < maxTicks && !sessionDone; tick += 1) {
    totalTicks += 1;
    const sec = totalTicks * STEP;

    const input = inputFor(run, tick) || {};
    run.step(input);
    const tickEvents = run.drainEvents();

    if (input.to != null) {
      if (firstInputSec < 0) firstInputSec = Math.round(sec * 10) / 10;
      actions += 1;
    }
    const idle = input.to == null && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'win' && firstSuccessSec < 0) firstSuccessSec = Math.round(sec * 10) / 10;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }

    if (run.phase === 'won') {
      levelsReached = Math.max(levelsReached, run.levelIndex + 1);
      if (run.levelIndex + 1 >= LEVEL_COUNT) {
        completed = true;
        sessionDone = true;
      } else {
        run = createRun({ levelIndex: run.levelIndex + 1, seed: (seed + run.levelIndex + 1) >>> 0 });
      }
    } else if (run.phase === 'failed') {
      deaths += 1;
      completed = false;
      sessionDone = true;
    }
  }

  const durationSec = Math.max(totalTicks * STEP, 1e-6);
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : firstInputSec,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : firstSuccessSec,
    deaths,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached,
    completed,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'constellation-line', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const strategies = [
  { name: 'greedy', inputFor: makeGreedy(), seed: 123 },
  { name: 'random', inputFor: makeRandom(456), seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents},idle=${r.idleSec}s,gap=${r.maxEventGapSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
