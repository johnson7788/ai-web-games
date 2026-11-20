// STAR SWAP · M1 无头自玩：3 策略（greedy / random / noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
//
// 三消是「离散交换」操作：greedy 每 tick 扫描全部相邻交换、评估收益、挑最高的一步立即执行；
// 这是标准的贪心求解器（不是 settle-and-hold 假输入——每 tick 都是一次真实扫描 + 真实交换）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { findValidSwaps, evaluateSwap } from '../src/game/board.js';
import { levelAt } from '../config/levels.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：扫描最高收益交换（优先成特殊星 / 高连锁） ----------
function greedyInput(run) {
  const lvl = levelAt(run.level);
  const swaps = findValidSwaps(run.grid);
  if (!swaps.length) return { swap: null };
  let best = null;
  let bestScore = -Infinity;
  for (const [a, b] of swaps) {
    const r = evaluateSwap(run.grid, a, b, lvl.colors, run.gravity);
    if (!r.valid) continue;
    // 收益 = 得分 + 特殊星强权重 + 连锁小权重（引导 greedy 蓄四连/五连）
    const score = r.score + (r.specials || 0) * 400 + (r.cascades || 0) * 30;
    if (score > bestScore) { bestScore = score; best = [a, b]; }
  }
  return best ? { swap: { a: best[0], b: best[1] } } : { swap: null };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  return (run) => {
    const R = 8; const C = 8;
    for (let tries = 0; tries < 8; tries += 1) {
      const a = Math.floor(rng() * R * C);
      const r = Math.floor(a / C); const c = a % C;
      const d = dirs[Math.floor(rng() * 4)];
      const nr = r + d[0]; const nc = c + d[1];
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      const b = nr * C + nc;
      if (run.grid[a] == null || run.grid[b] == null) continue;
      return { swap: { a, b } };
    }
    return { swap: null };
  };
}

function noinput() { return {}; }

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, startLevel: 1 });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run) || {};
    run.step(input);
    const sec = run.simTime;

    const acted = !!(input.swap || input.lens);
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    if (tickEvents.some((e) => e.type === 'swap')) actions += 1; // 被接受的有效交换
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'clearStar' || e.type === 'match') && firstSuccessSec === null) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.simTime;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec === null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase === 'win',
    finalLevel: run.level,
    finalScore: run.score,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'star-swap', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
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
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.finalLevel},dead=${r.deaths},dur=${r.durationSec}s,actions=${r.actions})`).join('  '));
console.log('autoplay.json records:', all.length);
