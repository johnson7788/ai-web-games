// tools/selfplay.mjs — CARD LORD 无头自玩：3 策略（greedy / random / noinput）各跑一局。
// 直接 node 驱动 createRun（不需要 playwright），把遥测写入 tools/fun/autoplay.json。
// greedy 用 AI 策略打人类座位，必须在第 3 局内推进（levelsReached >= 3）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/engine.js';
import { chooseBid, chooseDouble, chooseLead, chooseFollow } from '../src/game/ai.js';
import { sortHand } from '../src/game/cards.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 人类输入策略 ----------

function humanDecision(run, kind) {
  const round = run.round;
  const hand = run.hands ? run.hands[0] : [];
  const rp = run.roundPhase;
  if (rp === 'bidding') {
    if (kind === 'greedy') return { action: 'bid', bid: chooseBid(hand, 1) };
    if (kind === 'random') return { action: 'bid', bid: Math.floor(Math.random() * 4) }; // 0..3，引擎会钳制
    return {};
  }
  if (rp === 'doubling') {
    if (kind === 'greedy') return { action: 'double', double: chooseDouble(hand, 1) };
    if (kind === 'random') return { action: 'double', double: Math.random() < 0.5 };
    return {};
  }
  if (rp === 'playing') {
    const ctx = { landlord: round.landlord, seat: 0, lastPlaySeat: round.lastPlaySeat, handCounts: round.hands.map((h) => h.length) };
    if (kind === 'greedy') {
      if (round.lastPlaySeat === 0 || round.lastPlaySeat === -1) {
        const lead = chooseLead(hand, 1, ctx);
        return lead ? { action: 'play', cards: lead } : { action: 'pass' };
      }
      const f = chooseFollow(hand, round.lastPlay, 1, ctx);
      return f ? { action: 'play', cards: f } : { action: 'pass' };
    }
    if (kind === 'random') {
      if (round.lastPlaySeat === 0 || round.lastPlaySeat === -1) {
        const sorted = sortHand(hand);
        const idx = Math.floor(Math.random() * sorted.length);
        return { action: 'play', cards: [sorted[idx]] };
      }
      if (Math.random() < 0.5) return { action: 'pass' };
      const f = chooseFollow(hand, round.lastPlay, 0.5);
      return f ? { action: 'play', cards: f } : { action: 'pass' };
    }
  }
  return {}; // noinput
}

// ---------- 跑一局（会话） ----------

function play(name, seed) {
  const run = createRun({ seed, startTier: 1 });
  const maxTicks = Math.round(MAX_SEC / 0.4) + 100;

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let deaths = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    // 上一局结束（胜利）→ 开下一局
    if (run.roundPhase === 'done') run.advance();
    if (run.phase !== 'playing') break;

    const isHumanTurn = run.currentTurn === 0
      && ['bidding', 'doubling', 'playing'].includes(run.roundPhase);
    const input = humanDecision(run, name);
    const isRealInput = name !== 'noinput' && isHumanTurn;

    run.step(input);
    const sec = run.time;
    const events = run.drainEvents();

    if (isRealInput && firstInputSec < 0) firstInputSec = sec;
    if (isRealInput) actions += 1;

    const idle = !isRealInput && events.length === 0;
    if (idle) idleTicks += 1;

    for (const e of events) {
      eventKinds.add(e.type);
      if (e.type === 'roundWin' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (e.type === 'roundLose') deaths += 1;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  const levelsReached = run.stats.maxTier;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached,
    completed: levelsReached >= 12,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
  return records;
}

const records = [
  play('greedy', 17),
  play('random', 456),
  play('noinput', 789),
];
writeRuns(records);
for (const r of records) {
  console.log(`${r.policy}: dur=${r.durationSec}s wins->tier${r.levelsReached} deaths=${r.deaths} actions=${r.actions} idle=${r.idleSec}s maxGap=${r.maxEventGapSec}s events=${r.uniqueEvents} firstWin=${r.firstSuccessSec}`);
}
