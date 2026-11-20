// FOG TOWN · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { greedyDir } from '../src/game/mapgen.js';
import { mulberry32 } from '../src/game/rng.js';
import { DIRS } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限 5 分钟，防 bot 永续
const INPUT_LATENCY_MS = 90; // 遥测常量：假定的输入到 sim 延迟（无头循环本身更快）

function stateForRun(run) {
  return {
    player: run.player,
    keyCollected: run.keyCollected,
    leverOn: run.leverOn,
    cluesCollected: run.cluesCollected,
    clueTaken: run.clueTaken,
  };
}

// greedy：已知图 BFS 最短路（key→lever→clues→exit 顺序）
function greedyInput(run) {
  return { dir: greedyDir(run.map, stateForRun(run)) };
}

// random：乱按（真实随机方向）
function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const names = Object.keys(DIRS);
  return () => ({ dir: names[Math.floor(rng() * names.length)] });
}

function noinput() {
  return { dir: null };
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

    const hasInput = input.dir != null || input.echo;
    if (firstInputSec < 0 && hasInput) firstInputSec = sec;
    if (hasInput) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !hasInput && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'blockClear' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.bestBlock,
    completed: run.phase === 'won',
    blocksCleared: run.stats.blocksCleared,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(block=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
