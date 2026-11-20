// DIG DEEP · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 120; // 单局上限 2 分钟
const INPUT_LATENCY_MS = 90;

// ---------- greedy：优先吃钻石化石 + 软块，绕开熔岩/岩块 ----------
function greedyInput(run) {
  const front = run.peek(run.depth);
  let targetCol = run.col;
  let bestScore = -Infinity;

  for (let c = 0; c < 5; c += 1) {
    const cell = front[c];
    if (!cell.alive) continue;
    let s;
    if (cell.type === 'lava') s = -1000;
    else if (cell.type === 'rock') s = (run.maxTool >= 2 && run.laserCharges > 0) ? -8 : -200;
    else if (cell.type === 'diamond') s = 120 - cell.hard * 8;
    else if (cell.type === 'fossil') s = 110 - cell.hard * 8;
    else if (cell.type === 'fault') s = 45 - cell.hard * 8;
    else s = 25 - cell.hard * 8; // dirt
    if (s > bestScore) { bestScore = s; targetCol = c; }
  }

  const cell = front[targetCol];
  let tool = run.tool;
  if (cell.type === 'rock') {
    if (run.maxTool >= 2 && run.laserCharges > 0) tool = 2;
  } else {
    tool = run.maxTool >= 1 ? 1 : 0; // 钻头对一切可挖格更优
  }

  return { move: Math.sign(targetCol - run.col), dig: run.col === targetCol, tool };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    const r = rng();
    const move = r < 0.25 ? -1 : r < 0.5 ? 1 : 0;
    const dig = rng() < 0.5;
    const tool = run.maxTool > 0 && rng() < 0.3 ? 1 : 0;
    return { move, dig, tool };
  };
}

function noinput() {
  return { move: 0, dig: false, tool: 0 };
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
  let prevMove = 0;
  let prevDig = false;
  let prevTool = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    const move = input.move || 0;
    const dig = !!input.dig;
    const tool = input.tool ?? run.tool;

    run.step({ move, dig, tool });
    const sec = run.time;

    if (firstInputSec < 0 && (move !== 0 || dig || tool !== run.tool)) firstInputSec = sec;

    const moveChanged = move !== prevMove;
    const digToggled = dig !== prevDig;
    const toolChanged = tool !== prevTool;
    if (moveChanged || digToggled || toolChanged) actions += 1;
    const tickEvents = run.drainEvents();
    // 空转 = 该 tick 既无输入动作（按住挖/横移/切工具都算输入）也无任何事件
    const idle = move === 0 && !dig && tool === prevTool && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevMove = move;
    prevDig = dig;
    prevTool = tool;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'cellBreak' || e.type === 'diamond' || e.type === 'fossil' || e.type === 'layerEnter') && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.zoneReached,
    completed: run.phase !== 'dead',
    maxDepth: run.depth,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(depth=${r.maxDepth},dead=${r.deaths},layer=${r.levelsReached},ev=${r.uniqueEvents},gap=${r.maxEventGapSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
