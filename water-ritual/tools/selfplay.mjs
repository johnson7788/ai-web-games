// tools/selfplay.mjs — WATER RITUAL 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限 5 分钟（greedy 可跑满 12 天，random/noinput 更早结束）
const INPUT_LATENCY_MS = 90;

// ---------- greedy：按水温曲线在区间内松手；到线前做一次「点按续倒」微调 ----------
function makeGreedy() {
  return (run) => {
    const hud = run.getHud();
    const o = hud.currentOrder;
    const p = hud.pour;
    if (!o) { run._feathered = false; run._refeathered = false; return { pouring: false }; }
    if (p.state === 'idle') { run._feathered = false; run._refeathered = false; return { pouring: true }; }
    if (p.state === 'pouring') {
      const remaining = o.line - p.level;
      if (remaining <= 0.02) {
        if (!run._feathered) { run._feathered = true; return { pouring: false }; } // 微松
        return { pouring: false }; // 最终松手（结算）
      }
      return { pouring: true };
    }
    if (p.state === 'pending') {
      if (run._feathered && !run._refeathered) { run._refeathered = true; return { pouring: true }; } // 续倒
      return { pouring: false }; // 等宽限过去 → 结算
    }
    return { pouring: false };
  };
}

function makeRandom(seed) {
  const rng = mulberry32(seed);
  let toggleAt = 0;
  let pouring = false;
  return (_run, tick) => {
    if (tick >= toggleAt) {
      pouring = !pouring;
      toggleAt = tick + 10 + Math.floor(rng() * 30);
    }
    return { pouring };
  };
}

function noinput() {
  return { pouring: false };
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
  let prevPouring = false;

  for (let tick = 0; tick < maxTicks && (run.phase === 'playing' || run.phase === 'shop'); tick += 1) {
    if (run.phase === 'shop') { run.autoShop(); continue; }

    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    const pouring = !!input.pouring;
    run.step({ pouring, skip: !!input.skip });
    const sec = run.time;

    const changed = pouring !== prevPouring;
    if (changed) {
      actions += 1;
      if (firstInputSec < 0) firstInputSec = sec;
    }
    prevPouring = pouring;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入变化、也无任何游戏事件（倒水过程 pourTick 在流，不算空转）
    const idle = !changed && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'orderScored' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.maxDay || run.day,
    completed: run.phase === 'won',
    maxDay: run.stats.maxDay,
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'sim', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const greedy = makeGreedy();
const random = makeRandom(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedy(run, tick), seed: 123 },
  { name: 'random', inputFor: (run, tick) => random(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(day=${r.maxDay},dead=${r.deaths},dur=${r.durationSec}s,act=${r.actions},idle=${(r.idleSec / r.durationSec * 100).toFixed(0)}%,gap=${r.maxEventGapSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
