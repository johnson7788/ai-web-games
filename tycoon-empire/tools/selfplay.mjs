// tools/selfplay.mjs — 无头自玩：3 策略（greedy/random/noinput）各跑一局，写 tools/fun/autoplay.json。
// 直接 node 循环 step（不需要 playwright）；遥测 schema 与 fun-report 硬校验一致。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { incomeRate, upgradeCost, INDUSTRIES } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 90;           // 单局上限 90s
const INPUT_LATENCY_MS = 90;

function hasAction(input) {
  return !!input.tap || input.buy != null || input.upgrade != null || input.hire != null ||
    !!input.collect || !!input.allIn || !!input.loan || !!input.repay;
}

// ---------- greedy：性价比优先购买，安全推进（不押注、不贷款） ----------
function greedyInput(run, tick) {
  const input = {};
  // 点击主资产：按住连点（idle-clicker 的真实操作模型），偶发微停顿
  if (tick % 30 !== 0) input.tap = true;

  const hud = run.getHud();
  const owned = hud.industries.filter((i) => i.owned);

  // 1) 买最便宜的可解锁产业
  const buyable = hud.industries
    .filter((i) => i.unlocked && !i.owned)
    .sort((a, b) => a.buyCost - b.buyCost);
  if (buyable.length && run.cash >= buyable[0].buyCost) {
    input.buy = buyable[0].index;
    return input;
  }

  // 2) 雇最便宜的经理（自动化）
  const hireable = owned
    .filter((i) => !i.manager)
    .sort((a, b) => a.managerCost - b.managerCost);
  if (hireable.length && run.cash >= hireable[0].managerCost) {
    input.hire = hireable[0].index;
    return input;
  }

  // 3) 升级边际性价比最高的产业
  let best = null;
  let bestScore = -Infinity;
  for (const ind of owned) {
    const gain = incomeRate(ind.index, ind.level + 1) - incomeRate(ind.index, ind.level);
    const cost = upgradeCost(ind.index, ind.level);
    const score = gain / Math.max(1, cost);
    if (score > bestScore && run.cash >= cost) { bestScore = score; best = ind.index; }
  }
  if (best != null) { input.upgrade = best; return input; }

  // 4) 有未收收益就收
  if (owned.some((i) => i.pending > 0)) input.collect = true;

  return input;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    const input = {};
    if (rng() < 0.08) input.tap = true;
    if (rng() < 0.02) {
      const hud = run.getHud();
      const buyable = hud.industries.filter((i) => i.unlocked && !i.owned);
      if (buyable.length) input.buy = buyable[Math.floor(rng() * buyable.length)].index;
    }
    if (rng() < 0.02) {
      const owned = run.getHud().industries.filter((i) => i.owned);
      if (owned.length) input.upgrade = owned[Math.floor(rng() * owned.length)].index;
    }
    if (rng() < 0.02) {
      const owned = run.getHud().industries.filter((i) => i.owned && !i.manager);
      if (owned.length) input.hire = owned[Math.floor(rng() * owned.length)].index;
    }
    if (rng() < 0.05) input.collect = true;
    if (rng() < 0.005) input.allIn = true;
    if (rng() < 0.004) input.loan = true;
    if (rng() < 0.004) input.repay = true;
    return input;
  };
}

function noinput() {
  return {};
}

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;
    const acted = hasAction(input);
    if (acted) actions += 1;
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    // 空转 = 该 tick 既无输入动作也无任何事件
    if (!acted && tickEvents.length === 0) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'buy' && firstSuccessSec === null) firstSuccessSec = sec;
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
    firstSuccessSec: firstSuccessSec === null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.unlockedCount,
    completed: false,
    bankrupts: run.stats.bankrupts,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'sim', runs: records, generatedAt: new Date().toISOString() };
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
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.levelsReached},acts/min=${r.actionsPerMin},idle=${Math.round((r.idleSec / r.durationSec) * 100)}%,ev=${r.uniqueEvents},gap=${r.maxEventGapSec}s,first=${r.firstSuccessSec}s)`).join('  '));
