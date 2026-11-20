// tools/selfplay.mjs — 无头自玩：3 策略（greedy/random/noinput）各跑一局，写入 tools/fun/autoplay.json。
// 直接 node 循环 step（无需 playwright）；greedy = 最大连通块优先，验证推进/首胜。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, allComponents } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 200;             // 单局上限，防永续
const INPUT_LATENCY_MS = 90;     // 遥测常量：无头循环输入到 sim 的假定延迟

// greedy：最大连通块优先，带真实反应冷却（~0.5s）与轻微震颤噪声。
function greedyInput(run, tick) {
  run._botCd = (run._botCd ?? 0) - 1;
  if (run._botCd > 0) return {};
  const comps = allComponents(run.grid, run.frozen);
  if (!comps.length) return {};
  run._botCd = 28 + Math.floor(run.rng() * 8);
  return { action: 'tap', x: comps[0].x, y: comps[0].y };
}

// random：乱按（偏小簇的无策略消法）；用于验证输入鲁棒与失败路径。
// 用小簇优先模拟「不规划」的玩家，必然在某关分数不足而失败。
function makeRandom(seed) {
  const rng = mulberry32(seed);
  let cd = 0;
  return (run) => {
    cd -= 1;
    if (cd > 0) return {};
    const comps = allComponents(run.grid, run.frozen);
    if (!comps.length) return {};
    cd = 16 + Math.floor(rng() * 16);
    const small = comps[comps.length - 1 - Math.floor(rng() * Math.min(2, comps.length - 1))];
    return { action: 'tap', x: small.x, y: small.y };
  };
}

function noinput() { return {}; }

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

    const hadAction = !!input.action;
    if (firstInputSec < 0 && hadAction) firstInputSec = sec;
    if (hadAction) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !hadAction && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'pop' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    deaths: run.phase === 'failed' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.maxLevel,
    completed: run.phase === 'won',
    maxLevel: run.stats.maxLevel,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
  return records;
}

const randomInput = makeRandom(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run, tick), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.maxLevel},dead=${r.deaths},dur=${r.durationSec}s,acts=${r.actions},ev=${r.uniqueEvents})`).join('  '));
