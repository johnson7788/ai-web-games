// tools/selfplay.mjs — MARRY RICH · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需 playwright），把遥测写进 tools/fun/autoplay.json（schema 见 playtest-protocol）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { ATTRS } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限（noinput 会停住，靠上限截断）
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
function bestChoiceIndex(run) {
  const node = run.currentNode();
  if (!node) return 0;
  let best = 0;
  let bestScore = -Infinity;
  node.choices.forEach((c, i) => {
    const e = c.effects || {};
    // 固定策略线：能力+人脉优先，存款次之（逆袭成长线）
    const score = ((e.abi ?? 0) + (e.net ?? 0)) * 2 + (e.sav ?? 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function greedyInput(run) {
  if (run.stage === 'choice') {
    if (run.time >= run._revealUntil) return { choice: bestChoiceIndex(run), advance: false };
    return {};
  }
  if (run.stage === 'result') {
    if (run.time >= run._revealUntil) return { choice: null, advance: true };
    return {};
  }
  return {};
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    const node = run.currentNode();
    if (run.stage === 'choice') {
      if (run.time >= run._revealUntil) {
        const n = node ? node.choices.length : 2;
        return { choice: Math.floor(rng() * n), advance: false };
      }
      return {};
    }
    if (run.stage === 'result') {
      if (run.time >= run._revealUntil) return { choice: null, advance: true };
      return {};
    }
    return {};
  };
}

function noinput() {
  return {};
}

// ---------- 跑一局 ----------
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

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    const sentChoice = Number.isInteger(input.choice);
    const sentAdvance = !!input.advance;

    run.step(input);
    const sec = run.time;

    // 有效操作：发出且被接受（阶段变化）
    if (sentChoice && run.stage === 'result') actions += 1;
    else if (sentAdvance && run.stage !== 'result') actions += 1;

    if (firstInputSec < 0 && (sentChoice || sentAdvance)) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既没输入动作、也没收到任何游戏反馈事件（reveal 的 typeTick 在流，不算空转）
    const idle = !sentChoice && !sentAdvance && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'success' && firstSuccessSec == null) firstSuccessSec = sec;
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
    firstSuccessSec: firstSuccessSec == null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.chapter || 0,
    completed: run.phase === 'ended',
    endingId: run.ending?.id ?? null,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'marry-rich', genre: 'narrative', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: makeRandomStrategy(456), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(ch=${r.levelsReached},end=${r.endingId},done=${r.completed},acts=${r.actions},dur=${r.durationSec}s,idle=${r.idleSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
