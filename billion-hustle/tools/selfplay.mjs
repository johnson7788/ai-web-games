// BILLION HUSTLE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { PARTNERS } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 180;        // 单局上限 3 分钟（idle 类游戏没有死亡，用时间上限截断）
const INPUT_LATENCY_MS = 90;

function argmaxHeat(run) {
  let best = 0;
  for (let i = 1; i < run.sectors.length; i += 1) {
    if (run.sectors[i].heat > run.sectors[best].heat) best = i;
  }
  return best;
}

// greedy：优先买点击力 → 自动收入 → 伙伴；每 ~6 次/秒点击；每轮开头押最热赛道；冷却一好就烧钱。
function greedyInput(run) {
  let did = 0;
  run._clickTick = (run._clickTick ?? 0) + 1;
  if (run._clickTick % 10 === 0) if (run.click()) did += 1;

  if (run.buyUpgrade('tap')) did += 1;
  else if (run.buyUpgrade('auto')) did += 1;
  else {
    for (const p of PARTNERS) {
      if (run.hirePartner(p.id)) { did += 1; break; }
    }
  }
  if (run.bet === -1 && run.placeBet(argmaxHeat(run))) did += 1;
  const h = run.getHud();
  if (!h.burnActive && h.burnCooldownRemaining <= 0 && run.toggleBurn()) did += 1;
  return did;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    let did = 0;
    const r = rng();
    if (r < 0.45) { if (run.click()) did += 1; }
    else if (r < 0.65) { if (run.buyUpgrade(rng() < 0.5 ? 'tap' : 'auto')) did += 1; }
    else if (r < 0.85) {
      for (const p of PARTNERS) { if (run.hirePartner(p.id)) { did += 1; break; } }
    } else if (r < 0.95 && run.bet === -1) { if (run.placeBet(Math.floor(rng() * 6))) did += 1; }
    else if (run.toggleBurn()) did += 1;
    return did;
  };
}

function noinput() {
  return 0;
}

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let idleTicks = 0;
  let totalTicks = 0;
  let burnStarts = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const did = inputFor(run, tick) || 0;
    run.step();
    const sec = run.time;

    if (firstInputSec < 0 && did > 0) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入动作、也没收到任何游戏反馈事件（pulse 心跳保证经济无死时间）
    if (did === 0 && tickEvents.length === 0) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'burnStart') burnStarts += 1;
      if (e.type === 'fund' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const actions = run.stats.clicks + run.stats.upgradesBought + run.stats.partnersHired + run.stats.betsPlaced + burnStarts;
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
    deaths: 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.roundsReached,
    completed: run.phase === 'won',
    valuation: Math.floor(run.totalEarned),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'billion-hustle', genre: 'sim', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(round=${r.levelsReached},val=${r.valuation},won=${r.completed},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
