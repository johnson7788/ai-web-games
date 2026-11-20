// tools/selfplay.mjs — GOBLIN MINES · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测写进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { GOBLIN, STABILITY } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
// greedy：优先清岩壁→下挖→（shaft≥3 后停止下挖，靠匹配耗尽步数自然失败）；塌方前加固；有钱雇地精。
function greedyInput(run, tick) {
  if (run.phase !== 'playing') return {};

  // 塌方预警：临近时加固（有钱且未加固）
  const hud = run.getHud();
  if (hud.collapseIn <= 4 && !hud.reinforced && run.coins >= STABILITY.reinforceCost) {
    return { reinforce: true };
  }
  // 有钱雇地精（点亮中间列）
  if (run.goblins.length < 2) {
    const cost = GOBLIN.hireCostBase + run.goblins.length * GOBLIN.hireCostStep;
    if (run.coins >= cost) return { hire: 4 };
  }
  // 推进到第 3 矿道为止
  if (run.canDig() && run.shaft < 3) return { dig: true };
  // 之后不再下挖，持续匹配以耗尽步数（自然失败）
  const sw = run.findSwap(true) || run.findSwap(false);
  if (sw) return { swap: sw };
  return {};
}

// random：乱按——随机相邻交换 / 随机技能 / 随机下挖，验证输入鲁棒与边界。
function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    if (run.phase !== 'playing') return {};
    const roll = rng();
    if (roll < 0.08 && run.canDig()) return { dig: true };
    if (roll < 0.12) return { reinforce: true };
    if (roll < 0.18 && run.coins >= 20) return { hire: Math.floor(rng() * 9) };
    if (roll < 0.22) {
      const ids = ['fuelSurge', 'tnt', 'fuelCollect', 'precisePick'];
      const pos = { c: Math.floor(rng() * 9), r: Math.floor(rng() * 9) };
      return { skill: { id: ids[Math.floor(rng() * 4)], pos } };
    }
    // 随机相邻交换
    const c = Math.floor(rng() * 9); const r = Math.floor(rng() * 9);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dc, dr] = dirs[Math.floor(rng() * 4)];
    const c2 = c + dc; const r2 = r + dr;
    if (c2 >= 0 && c2 < 9 && r2 >= 0 && r2 < 9) return { swap: [[c, r], [c2, r2]] };
    return {};
  };
}

function noinput() { return {}; }

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC * 60);

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
    const input = inputFor(run, tick) || {};
    const acted = Object.keys(input).length > 0;
    if (firstInputSec < 0 && acted) firstInputSec = run.time;
    if (acted) actions += 1;

    run.step(input);
    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'match' || e.type === 'matchBig') && firstSuccessSec == null) firstSuccessSec = run.time;
      if (lastEventSec != null) { const gap = run.time - lastEventSec; if (gap > maxEventGap) maxEventGap = gap; }
      lastEventSec = run.time;
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
    firstSuccessSec: firstSuccessSec == null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: Math.max(run.shaft, run.stats.shaftReached),
    completed: run.phase !== 'dead',
    maxDepth: Math.floor(run.depth),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run, tick), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(shaft=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,idle=${r.idleSec}s,gap=${r.maxEventGapSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
