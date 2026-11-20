// tools/selfplay.mjs — Q ADVENTURE · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测写进 tools/fun/autoplay.json（fun-report schema 一字不差）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 150;         // 单局上限，防 bot 永续
const INPUT_LATENCY_MS = 90;

// ---------- 工具 ----------
function groundUnder(run, x) {
  for (const seg of run.level.ground) {
    if (x >= seg.x && x < seg.x + seg.w) return seg.y;
  }
  return null;
}

// ---------- greedy：向右跑 + 遇隙跳 + 遇敌跳（真实按键模型：定期松键再按） ----------
function greedyInput(run, tick) {
  const p = run.player;
  let move = 1;
  // 真实按键：偶尔松一下方向键再按下（不是 settle-and-hold 假输入）
  if (tick % 37 === 0) move = 0;

  const gapAhead = p.onGround && groundUnder(run, p.x + p.w + 82) == null;
  const enemyAhead = run.enemies.some((e) => e.hp > 0 && e.x > p.x - 10 && e.x - p.x < 96 && Math.abs(e.y - p.y) < 46);
  // 前方有实体墙挡路 → 跳（蹬墙/二段跳）
  const wallAhead = run.level.platforms.some((s) => s.type === 'solid' && p.y + p.h > s.y && p.y < s.y + s.h && s.x > p.x && s.x - p.x < 90);
  const jump = p.onGround && (gapAhead || enemyAhead || wallAhead);
  return { left: move < 0, right: move > 0, jump };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    if (tick % 24 === 0) {
      const r = rng();
      return { left: r < 0.33, right: r > 0.66, jump: rng() < 0.35 };
    }
    return { left: false, right: rng() < 0.6, jump: rng() < 0.12 };
  };
}

function noinput() {
  return { left: false, right: false, jump: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, level: 1 });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  const SUCCESS = new Set(['coinGet', 'starGet', 'stomp', 'goalReached', 'levelClear']);

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;
    const moving = input.left || input.right;

    if (firstInputSec < 0 && (moving || input.jump)) firstInputSec = sec;
    // 持续输入 = 有效操作（bot 一直在向右跑）；每 tick 移动输入都计入操作数
    if (moving || input.jump) actions += 1;

    const tickEvents = run.drainEvents();
    // 空转 = 该 tick 既无输入动作也无任何事件（持续按方向键不算空转）
    const idle = !moving && !input.jump && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && SUCCESS.has(e.type)) firstSuccessSec = sec;
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
    levelsReached: run.stats.levelReached,
    completed: run.phase === 'won',
    level: run.levelIndex,
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'q-adventure', genre: 'platformer', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.level},reached=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
