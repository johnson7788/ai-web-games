// tools/selfplay.mjs — DICE CASCADE 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step + 真实提交动作（押注/掷骰/收手），把遥测追加进 tools/fun/autoplay.json。
// 遥测契约：空转 = 该 tick 既无真实动作、无悬浮光标移动、也无任何事件（与 fun-report 定义一致）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { stageAt } from '../config/levels.js';
import { mulberry32 } from '../src/game/rng.js';
import { DICE } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// 押注期望值：p=0.5 每骰位命中高面（>=4），押中 1 → ×2、≥2 → ×3。
function bestBetCount(run) {
  const c = stageAt(run.stageIndex);
  const maxBets = run.diceCount;
  let bestK = 0;
  let bestEV = -Infinity;
  const p = 0.5;
  const baseGain = 7; // 单次掷骰的近似基础收益（期望管理用近似值即可）
  for (let k = 0; k <= maxBets; k += 1) {
    if (k * c.betCost > run.pot) continue;
    const pNone = Math.pow(p, k);
    const pOne = k * Math.pow(p, k);
    const pMulti = 1 - pNone - pOne;
    const evMult = 1 * pNone + 2 * pOne + 3 * pMulti;
    const ev = baseGain * evMult - k * c.betCost;
    if (ev > bestEV) { bestEV = ev; bestK = k; }
  }
  return bestK;
}

// greedy：期望值押注 + 冲分（只在最后一掷才收手，赌性拉满 → 会推进到第 3 关以上，也会在诅咒关翻车）。
function greedyInput(run, tick) {
  const out = { roll: false, bank: false, toggles: [], cursorX: 640 + Math.sin(tick * 0.9) * 8 + (tick % 2 ? 3 : -3) };
  if (run.rolling) return out;
  const c = stageAt(run.stageIndex);
  if (run.pot >= c.target && run.rollsLeft <= 1) { out.bank = true; return out; }
  const want = new Set([0, 1, 2].slice(0, bestBetCount(run)));
  const current = new Set(run.betSel);
  for (let i = 0; i < run.diceCount; i += 1) {
    if (want.has(i) !== current.has(i)) out.toggles.push(i);
  }
  if (run.rollsLeft > 0) out.roll = true;
  return out;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    const out = { roll: false, bank: false, toggles: [], cursorX: 640 + Math.sin(tick * 0.9) * 10 + (tick % 2 ? 3 : -3) };
    if (run.rolling) return out;
    const c = stageAt(run.stageIndex);
    const want = new Set();
    for (let i = 0; i < run.diceCount; i += 1) if (rng() < 0.4) want.add(i);
    // 修正成本，押不起就去掉
    while (want.size * c.betCost > run.pot && want.size > 0) want.delete([...want][0]);
    const current = new Set(run.betSel);
    for (let i = 0; i < run.diceCount; i += 1) {
      if (want.has(i) !== current.has(i)) out.toggles.push(i);
    }
    if (rng() < 0.9) out.roll = true;
    return out;
  };
}

function noinput() {
  return { roll: false, bank: false, toggles: [], cursorX: null };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, runeLevel: 0, autoRoll: true });
  const maxTicks = Math.round(MAX_SEC * 60);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let prevCursorX = null;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};

    for (const t of input.toggles || []) {
      run.toggleBet(t);
      if (run.phase !== 'playing') break;
    }
    if (input.roll && run.phase === 'playing') run.roll();
    if (input.bank && run.phase === 'playing') run.bank();

    const acted = (input.roll || input.bank || (input.toggles && input.toggles.length > 0));
    if (acted) {
      actions += (input.roll ? 1 : 0) + (input.bank ? 1 : 0) + (input.toggles ? input.toggles.length : 0);
      if (firstInputSec < 0) firstInputSec = run.time;
    }

    const cursorMoved = input.cursorX != null && prevCursorX != null && Math.abs(input.cursorX - prevCursorX) > 0.5;
    prevCursorX = input.cursorX;

    run.step({ cursorX: input.cursorX });
    const tickEvents = run.drainEvents();

    const idle = !acted && !cursorMoved && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'stageClear' && firstSuccessSec < 0) firstSuccessSec = run.time;
      if (lastEventSec != null) {
        const gap = run.time - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
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
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.stageReached || (run.stageIndex + 1),
    completed: run.phase !== 'dead',
  };
}

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
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(stage=${r.levelsReached},dead=${r.deaths},act=${r.actions},dur=${r.durationSec}s,succ=${r.firstSuccessSec})`).join('  '));
console.log('autoplay.json records:', records.length);
