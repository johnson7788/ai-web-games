// PLUMBER RUN · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
const TILE = WORLD.TILE;
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：直走 + 扳手清敌 + 遇坑/墙跳 ----------
function greedyInput(run, tick, bot) {
  const p = run.player;
  const lookPx = 9 * TILE;
  const pc = Math.floor(p.x / TILE);

  // 坑：前方地面（第 14 行）出现空格
  let pitDist = Infinity;
  for (let c = pc; c <= pc + Math.ceil(lookPx / TILE) && c < run.width; c += 1) {
    if (run.grid[14][c] === '.' && c * TILE - p.x > -10) { pitDist = c * TILE - p.x; break; }
  }

  // 敌人：前方同高度
  let enemyDist = Infinity;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const dx = e.x - p.x;
    if (dx > -10 && dx < lookPx && Math.abs(e.y - p.y) < 60) enemyDist = Math.min(enemyDist, dx);
  }

  // 尖刺：前方
  let spikeDist = Infinity;
  for (const s of run.spikes) {
    const dx = s.x - p.x;
    if (dx > -10 && dx < lookPx) spikeDist = Math.min(spikeDist, dx);
  }

  // 跳跃只用于坑/尖刺；敌人交给扳手远程清掉（本作没有需要跳过的实体墙，浮空块可从下方通过）
  const wantJump = pitDist < 1.5 * TILE || spikeDist < 1.6 * TILE;

  // 扳手：5 格内（225px，在射程 340px 内）有敌人就扔
  let wantWrench = enemyDist < 5 * TILE;
  // 扳手冷却中且敌人贴脸 → 紧急跳过去（踩或躲）
  const emergencyJump = enemyDist < 1.2 * TILE;

  if ((wantJump || emergencyJump) && !bot.jumping) {
    bot.jumping = true;
    bot.jumpFrames = 0;
  }
  if (bot.jumping) {
    bot.jumpFrames += 1;
    if (bot.jumpFrames > 40) { bot.jumping = false; }
  }
  if (wantWrench && !bot.wrenching) {
    bot.wrenching = true;
    bot.wrenchFrames = 0;
  }
  if (bot.wrenching) {
    bot.wrenchFrames += 1;
    if (bot.wrenchFrames > 4) bot.wrenching = false;
  }

  return { right: true, jumpHeld: !!bot.jumping, wrenchHeld: !!bot.wrenching, steamHeld: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let held = { left: false, right: false, jumpHeld: false, wrenchHeld: false, steamHeld: false };
  let until = 0;
  return (run, tick) => {
    if (tick >= until) {
      // 每 0.3–0.8s 重新决定一次（真实乱按：有节奏地换键）
      until = tick + 18 + Math.floor(rng() * 30);
      held.left = rng() < 0.25;
      held.right = rng() < 0.5;
      held.jumpHeld = rng() < 0.4;
      held.wrenchHeld = rng() < 0.2;
      held.steamHeld = rng() < 0.1;
      if (held.left && held.right) held.right = false;
    }
    return { ...held };
  };
}

function noinput() {
  return { left: false, right: false, jumpHeld: false, wrenchHeld: false, steamHeld: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, level: 1 });
  const maxTicks = Math.round(MAX_SEC / STEP);
  const bot = {};

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let prev = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick, bot) || {};
    run.step(input);
    const sec = run.time;

    const acted = input.left || input.right || input.jumpHeld || input.wrenchHeld || input.steamHeld;
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    // 有效操作：任一输入位发生变化（按下/松开都算一次人类操作）
    const cur = `${input.left ? 1 : 0}${input.right ? 1 : 0}${input.jumpHeld ? 1 : 0}${input.wrenchHeld ? 1 : 0}${input.steamHeld ? 1 : 0}`;
    if (prev != null && cur !== prev) actions += 1;
    prev = cur;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && (e.type === 'coin' || e.type === 'stomp' || e.type === 'powerUp' || e.type === 'brickBreak' || e.type === 'levelClear')) {
        firstSuccessSec = sec;
      }
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
    deaths: run.stats.deaths,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase !== 'dead',
    maxLevel: run.stats.levelsReached,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'plumber-run', genre: 'action', source: 'bot', generatedAt: new Date().toISOString(), runs: records };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.maxLevel},dead=${r.deaths},dur=${r.durationSec}s,apm=${r.actionsPerMin})`).join('  '));
console.log('autoplay.json records:', records.length);
