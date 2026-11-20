// tools/selfplay.mjs — CELL WARS · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测写入 tools/fun/autoplay.json。
// 玩家 bot 用连续「悬浮光标 + 震颤」输入模型（真实触屏/鼠标行为），空转只按「无输入且无事件」计。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { OWNER } from '../config/gameplay.js';
import { listFrontier } from '../src/game/board.js';
import { choosePlayerAction } from '../src/game/ai.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const MAX_SEC = 300;         // 单局上限 5 分钟
const INPUT_LATENCY_MS = 90; // 遥测常量：假定输入→sim 延迟

// 连续悬浮光标（真实操作模型：追目标 + 生理震颤），用于空转判定。
function makeCursor(rng) {
  const cur = { r: 3.5, c: 3.5 };
  return (run, action, tick) => {
    const tr = action ? action.r : (run.size - 1) / 2 + Math.sin(tick / 31) * (run.size / 2);
    const tc = action ? action.c : (run.size - 1) / 2 + Math.cos(tick / 37) * (run.size / 2);
    cur.r += (tr - cur.r) * 0.6 + (rng() - 0.5) * 0.8;
    cur.c += (tc - cur.c) * 0.6 + (rng() - 0.5) * 0.8;
    return { r: cur.r, c: cur.c };
  };
}

// ---------- 策略 ----------
const greedyCursor = makeCursor(mulberry32(999));

function greedyInput(run, tick) {
  let action = null;
  if (run.turn === 'player') action = choosePlayerAction(run);
  return { action, cursor: greedyCursor(run, action, tick) };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const cursor = makeCursor(rng);
  return (run, tick) => {
    let action = null;
    if (run.turn === 'player') {
      const frontier = listFrontier(run.board, run.size, OWNER.PLAYER);
      const roll = rng();
      if (roll < 0.7 && frontier.length) {
        const [r, c] = frontier[Math.floor(rng() * frontier.length)];
        action = { kind: 'infect', r, c };
      } else if (roll < 0.85 && run.playerNutrientAvailable) {
        const owned = [];
        for (let r = 0; r < run.size; r += 1) for (let c = 0; c < run.size; c += 1) if (run.board[r][c].o === OWNER.PLAYER) owned.push([r, c]);
        if (owned.length) {
          const [r, c] = owned[Math.floor(rng() * owned.length)];
          action = { kind: 'nutrient', r, c };
        }
      } else if (roll < 0.95 && run.playerPhage.ready) {
        action = { kind: 'phage', r: Math.floor(rng() * (run.size - 1)), c: Math.floor(rng() * (run.size - 1)) };
      } else if (frontier.length) {
        const [r, c] = frontier[Math.floor(rng() * frontier.length)];
        action = { kind: 'infect', r, c };
      }
    }
    return { action, cursor: cursor(run, action, tick) };
  };
}

function noinput() {
  return { action: null, cursor: null };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / (1 / 60));
  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let prevCursor = null;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (run.phase === 'cleared') run.continue();
    if (run.phase === 'lost' || run.phase === 'victory') break;

    totalTicks += 1;
    const inp = inputFor(run, tick) || {};
    if (inp.action) {
      actions += 1;
      if (firstInputSec < 0) firstInputSec = run.time;
    }
    const cursorMoved = inp.cursor
      ? (prevCursor == null || Math.abs(inp.cursor.r - prevCursor.r) > 0.01 || Math.abs(inp.cursor.c - prevCursor.c) > 0.01)
      : false;
    prevCursor = inp.cursor;

    run.step({ action: inp.action });
    const sec = run.time;
    const tickEvents = run.drainEvents();

    const idle = !cursorMoved && !inp.action && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'capture' && firstSuccessSec == null) firstSuccessSec = sec;
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
    deaths: run.phase === 'lost' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.maxDish,
    completed: run.phase === 'victory',
    maxDish: run.stats.maxDish,
    dishesCleared: run.stats.dishesCleared,
  };
}

// ---------- 写文件 ----------
const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'cell-wars', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(dish=${r.maxDish},cleared=${r.dishesCleared},dead=${r.deaths},dur=${r.durationSec}s,actions=${r.actions})`).join('  '));
console.log('autoplay.json records:', records.length);
