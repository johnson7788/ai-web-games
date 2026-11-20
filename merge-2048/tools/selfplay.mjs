// MERGE 2048 · 无头自玩：3 策略（greedy/random/noinput）各跑一局，写 tools/fun/autoplay.json
// greedy 用经典 2048 角落策略（src/game/ai.js），必须推进到第 3 关以上。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { bestMove } from '../src/game/ai.js';
import { mulberry32 } from '../src/game/rng.js';
import { MOVE_SEC } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 120;
const THINK_SEC = { greedy: 0.04, random: 0.04, noinput: 0 };
const INPUT_LATENCY_MS = 90;
const DIRS = ['up', 'down', 'left', 'right'];

function optsFor(run) {
  return { rows: run.rows, cols: run.cols, blocked: run.blocked, gravity: run.gravity };
}

function greedyInput(run) {
  const dir = bestMove(run.grid, optsFor(run));
  return dir ? { dir } : null;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return () => ({ dir: DIRS[Math.floor(rng() * DIRS.length)] });
}

function noinput() {
  return null;
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  let wall = 0;
  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = -1;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleSec = 0;

  const think = THINK_SEC[name] ?? 0.04;

  while (run.phase === 'playing' && wall < MAX_SEC) {
    const input = inputFor(run);
    if (input && input.dir) {
      if (firstInputSec < 0) firstInputSec = wall;
      idleSec += think;          // 决策时间 = 无输入也无事件的空转
      wall += think;
      actions += 1;
      run.step({ dir: input.dir });
      const events = run.drainEvents();
      for (const e of events) {
        eventKinds.add(e.type);
        if (e.type === 'merge' && firstSuccessSec === null) firstSuccessSec = wall;
        if (lastEventSec >= 0) maxEventGap = Math.max(maxEventGap, wall - lastEventSec);
        lastEventSec = wall;
      }
      wall += MOVE_SEC;          // 滑动/生成动画
    } else {
      idleSec += 1 / 60;         // 无操作：完全空转
      wall += 1 / 60;
    }
  }

  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(wall * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 100) / 100,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec === null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round(idleSec * 100) / 100,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.maxLevel,
    completed: run.phase === 'won',
    maxTile: run.runBest,
    score: run.score,
  };
}

const randomInput = makeRandomStrategy(456 * 7 + 3);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: () => randomInput(), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ game: 'merge-2048', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,max=${r.maxTile},events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
