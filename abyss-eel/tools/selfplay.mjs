// ABYSS EEL · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { clamp, WORLD, BOSS } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限 5 分钟，防贪心 bot 永续
const INPUT_LATENCY_MS = 90; // 遥测常量：假定的输入到 sim 延迟（无头循环本身更快）

// ---------- 策略：inputFor(run, tick) → { steerX, dash } ----------
function widestGapX(run) {
  const headWorldY = run.depth * 10;
  const near = run.walls
    .filter((w) => Math.abs(w.worldY - headWorldY) < 400)
    .sort((a, b) => a.x - b.x);
  let bestX = run.head.x;
  let bestW = -1;
  let prevEdge = 0;
  for (const w of near) {
    const gap = w.x - prevEdge;
    if (gap > bestW) { bestW = gap; bestX = (prevEdge + w.x) / 2; }
    prevEdge = Math.max(prevEdge, w.x + w.w);
  }
  if (WORLD.WIDTH - prevEdge > bestW) {
    bestW = WORLD.WIDTH - prevEdge;
    bestX = (prevEdge + WORLD.WIDTH) / 2;
  }
  return bestX;
}

function greedyInput(run) {
  const headWorldY = run.depth * 10;
  let targetX = null;

  // 珠枯竭时保命：躲最宽缝
  if (run.orbsCount <= 6) {
    targetX = widestGapX(run);
  } else {
    // 持续织路：前方 700px 内有食物就先去吃（食物散布全屏，路径自然蜿蜒）
    let bestFoodX = null;
    let bestFoodScore = Infinity;
    for (const f of run.foods) {
      const ahead = f.worldY - headWorldY;
      if (ahead < -20 || ahead > 700) continue;
      const score = Math.abs(ahead) + Math.abs(f.x - run.head.x) * 0.5;
      if (score < bestFoodScore) { bestFoodScore = score; bestFoodX = f.x; }
    }
    // 朝最近低值墙（破墙换连击 + 火花回珠）
    let bestWallX = null;
    let bestWallScore = Infinity;
    for (const w of run.walls) {
      const ahead = w.worldY - headWorldY;
      if (ahead < -20 || ahead > 900) continue;
      const cx = w.x + w.w / 2;
      const score = Math.abs(ahead) + Math.abs(cx - run.head.x) * 0.5 + w.value * 3;
      if (score < bestWallScore) { bestWallScore = score; bestWallX = cx; }
    }
    targetX = bestFoodScore <= bestWallScore && bestFoodX != null ? bestFoodX : bestWallX;
  }
  if (targetX == null) targetX = run.head.x;
  // 人类运动噪声：到达后仍有过冲/再定位（每次 0.4s 级的微修正）
  run._botTick = (run._botTick ?? 0) + 1;
  if (run._botTick % 12 === 0) {
    const noise = (run.rng() - 0.5) * 40;
    run._botAim = clamp(targetX + noise, 0, WORLD.WIDTH);
  }
  const aim = run._botAim ?? targetX;

  // 真实拖动模型：手指以 ~540px/s 追目标；贴住目标后仍带 8–12Hz 生理震颤
  // （真实触屏 move 事件流就是这个样子——手指从不是像素级静止的）
  const finger = run._botFinger ?? run.head.x;
  const toward = clamp(aim - finger, -9, 9);
  const tremor = (run.rng() - 0.5) * 8;
  const steerX = clamp(finger + (Math.abs(aim - finger) > 12 ? toward : tremor), 0, WORLD.WIDTH);
  run._botFinger = steerX;
  return { steerX, dash: run.orbsCount > 25 }; // 珠>25 时按 dash
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let randX = 640;
  return (run, tick) => {
    if (tick % 30 === 0) randX = rng() * WORLD.WIDTH;
    return { steerX: randX, dash: rng() < 0.08 };
  };
}

function noinput() {
  return { steerX: null, dash: false };
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
  let prevSteer = null;
  let prevDash = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerX != null || input.dash)) firstInputSec = sec;

    // 主动微调：目标随场景滚动持续变化（预测拦截点），与真实玩家连续微调一致
    const steerChanged = input.steerX != null && (prevSteer == null || Math.abs(input.steerX - prevSteer) > 2);
    const dashToggled = !!input.dash !== prevDash;
    if (steerChanged || dashToggled) actions += 1;
    const tickEvents = run.drainEvents();
    // 空转 = 这一秒既没输入动作、也没收到任何游戏反馈事件（磨墙时 wallHit 在流，不算空转）
    const idle = !input.dash && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevSteer = input.steerX;
    prevDash = !!input.dash;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'wallBreak' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.zoneReached || run.zone || 1,
    completed: run.phase !== 'dead',
    maxDepth: Math.floor(run.depth),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件（整批替换，保持 fun-report 的 {runs:[...]} schema） ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(depth=${r.maxDepth},dead=${r.deaths},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
