// HOLE MUNCH · 无头自玩：3 策略（greedy/random/noinput）各跑一局，写 tools/fun/autoplay.json。
// 直接 node 循环 step（不需要 playwright）；遥测 schema 见 playtest-protocol。
// greedy 必须推进到第 3 场/等级以上（名次 ≤3 即晋级）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, HOLE, clamp, MATCH } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 400; // 单局上限，保证 greedy 能打完 2 场推进到第 3 场
const INPUT_LATENCY_MS = 90;

// ---------- greedy：奔向最近可吞物密集区，躲避更大的洞，捕食更小的洞 ----------
function greedyInput(run) {
  const p = run.player;
  if (!p.alive) return { steerX: p.tx, steerY: p.ty };

  let target = { x: p.x, y: p.y };

  // 1) 逃离更大的洞（只在真正被吞的威胁范围才逃，避免浪费吞食时间）
  for (const a of run.ai) {
    if (!a.alive || a.r <= p.r * 1.2) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < a.r * 1.0) {
      const vx = (p.x - a.x) / (d || 1);
      const vy = (p.y - a.y) / (d || 1);
      target = { x: clamp(p.x + vx * 460, 40, WORLD.WIDTH - 40), y: clamp(p.y + vy * 460, 40, WORLD.HEIGHT - 40) };
      return jitter(run, target);
    }
  }

  // 2) 捕食更小的洞（近处）
  for (const a of run.ai) {
    if (!a.alive || p.r <= a.r * HOLE.EAT_RATIO) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < p.r * 2.6) {
      target = { x: a.x, y: a.y };
      return jitter(run, target);
    }
  }

  // 3) 奔向最近可吞物（距离主导、价值微加权）：在集群内连续扫街
  let bestScore = Infinity;
  for (const o of run.objects) {
    if (o.r >= p.r * 0.92) continue; // 吞不下
    const mult = o.kind === 'meteor' ? run.mods.meteorMult : 1;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    // 连锁临门一脚：连锁即将触发时贴紧近处小物
    const nearChain = run.chain.count >= run.mods.chainCountReq - 2 ? 1.6 : 1;
    const score = d / (0.5 + o.mass * mult * nearChain);
    if (score < bestScore) {
      bestScore = score;
      target = { x: o.x, y: o.y };
    }
  }

  return jitter(run, target);
}

function jitter(run, target) {
  // 真实操作模型：目标连续微调 + 轻微生理震颤，不做 settle-and-hold 假输入
  run._botTick = (run._botTick ?? 0) + 1;
  // 平滑追踪目标（不整段大摆动，保持吞食路径高效）
  run._botAimX = clamp(lerp(run._botAimX ?? target.x, target.x, 0.5), 40, WORLD.WIDTH - 40);
  run._botAimY = clamp(lerp(run._botAimY ?? target.y, target.y, 0.5), 40, WORLD.HEIGHT - 40);
  const ax = run._botAimX;
  const ay = run._botAimY;
  return {
    steerX: clamp(ax + (run.rng() - 0.5) * 4, 40, WORLD.WIDTH - 40),
    steerY: clamp(ay + (run.rng() - 0.5) * 4, 40, WORLD.HEIGHT - 40),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  // 连续漫游（真实操作模型）：朝向缓慢漂移、撞墙反弹，不做整段跳变/瞬移。
  let heading = rng() * Math.PI * 2;
  let hx = WORLD.WIDTH / 2;
  let hy = WORLD.HEIGHT / 2;
  return (run, tick) => {
    if (tick % 72 === 0) heading += (rng() - 0.5) * 2.4;
    const sp = 320;
    hx += Math.cos(heading) * sp * STEP;
    hy += Math.sin(heading) * sp * STEP;
    if (hx < 40 || hx > WORLD.WIDTH - 40) heading = Math.PI - heading;
    if (hy < 40 || hy > WORLD.HEIGHT - 40) heading = -heading;
    hx = clamp(hx, 40, WORLD.WIDTH - 40);
    hy = clamp(hy, 40, WORLD.HEIGHT - 40);
    return { steerX: hx, steerY: hy };
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
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let prevSteer = null;
  let totalTicks = 0;
  let maxLevel = run.level;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    if (run.phase === 'campaignComplete') break;

    // 场间结算：晋级则推进，否则重试本场
    if (run.phase === 'matchEnd') {
      const r = run.result;
      if (r && r.qualified && run.level < MATCH.TOTAL_MATCHES) {
        run.advance(pickUpgrade(run));
        maxLevel = Math.max(maxLevel, run.level);
      } else {
        run.retry();
      }
      continue;
    }

    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.steerX != null || input.steerY != null)) firstInputSec = sec;

    const steerChanged = (input.steerX != null || input.steerY != null) && (prevSteer == null || Math.abs((input.steerX ?? 0) - (prevSteer ?? 0)) > 2);
    if (steerChanged) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = (input.steerX == null && input.steerY == null) && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevSteer = input.steerX;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if ((e.type === 'swallow' || e.type === 'building' || e.type === 'meteorGain') && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
    maxLevel = Math.max(maxLevel, run.level);
  }

  // durationSec 用整个循环的真实模拟时长（跨场重试 run.time 会归零，不能用它）
  const durationSec = totalTicks * STEP;
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
    idleSec: Math.round((idleTicks * STEP) * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: maxLevel,
    completed: run.phase === 'campaignComplete',
  };
}

function pickUpgrade(run) {
  const order = ['gravity-radius', 'devour-speed', 'move-speed', 'chain-lower', 'start-mass', 'max-radius'];
  return order[(run.level - 1) % order.length];
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'hole-munch', genre: 'arcade', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents},gap=${r.maxEventGapSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
