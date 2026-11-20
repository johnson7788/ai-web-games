// DONKEY HURDLE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;             // 单局上限 5 分钟
const INPUT_LATENCY_MS = 90;     // 遥测常量：假定输入到 sim 的延迟

// ---------- 策略：inputFor(run, tick) → { jump, dropJump } ----------
function nearestAhead(run) {
  let best = null;
  for (const o of run.obstacles) {
    if (o.cleared || o.hit) continue;
    const x = o.worldX - run.distPx;
    if (x > WORLD.PLAYER_X - 30 && x < WORLD.PLAYER_X + 900) {
      if (!best || x < best.x) best = { o, x };
    }
  }
  return best;
}

function greedyInput(run) {
  const ahead = nearestAhead(run);
  let jump = false;
  if (ahead) {
    const o = ahead.o;
    const nearEdge = ahead.x - o.w / 2;
    let trig;
    if (o.type === 'pit') trig = 90;
    else if (o.type === 'rock') trig = 175;
    else if (o.type === 'high') trig = 120;
    else trig = 100; // low
    jump = (nearEdge < WORLD.PLAYER_X + trig) && (nearEdge > WORLD.PLAYER_X - 40);
  }
  // 卸货跳：罐子富余（≥4）且前方是高墙/滚石时，偶尔用一次（真实玩家会在硬障碍前卸货保命）
  let dropJump = false;
  if (ahead && run.jars >= 4) {
    const t = ahead.o.type;
    if ((t === 'high' || t === 'rock') && ahead.x - ahead.o.w / 2 < WORLD.PLAYER_X + 150) dropJump = true;
  }
  return { jump, dropJump };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let jump = false;
  let nextFlip = 8;
  return (run, tick) => {
    if (tick >= nextFlip) {
      jump = rng() < 0.5;
      nextFlip = tick + 6 + Math.floor(rng() * 14);
    }
    return { jump, dropJump: false };
  };
}

function noinput() {
  return { jump: false, dropJump: false };
}

// ---------- 跑一局 ----------
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
  let prevJump = false;
  let prevDrop = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.jump || input.dropJump)) firstInputSec = sec;

    const jumpEdge = !!input.jump !== prevJump;
    const dropEdge = !!input.dropJump && !prevDrop;
    if (jumpEdge || dropEdge) actions += 1;
    prevJump = !!input.jump;
    prevDrop = !!input.dropJump;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入（按住跳跃也算持续输入）、也无任何游戏反馈事件
    const inputActive = !!input.jump || !!input.dropJump;
    const idle = !inputActive && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'obstacleClear' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.segmentReached || run.segment || 1,
    completed: run.phase !== 'dead',
    maxDistance: Math.floor(run.distance),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件（整批替换，保持 fun-report 的 {runs:[...]} schema） ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(dist=${r.maxDistance}m,seg=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,act=${r.actions},events=${r.uniqueEvents},gap=${r.maxEventGapSec}s,idle=${r.idleSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
