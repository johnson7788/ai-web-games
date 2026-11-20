// tools/selfplay.mjs — GOOSE LANE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测写入 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { clamp, GATE } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 120;         // 单局上限（足够 greedy 到第 3 站以上）
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
const greedyNoise = mulberry32(999); // 独立的转向噪声，不扰动游戏本体 rng

function greedyTarget(run) {
  // 障碍只要还没越过玩家线（z > 0）就视为「堵道」，避免在最后 0.4m 误判成空道
  const hazards = run.obstacles.filter((o) => !o.dead && !o.resolved && o.kind !== 'gate' && o.z > 0 && o.z < 24);
  const blocked = new Set(hazards.map((o) => o.lane));
  const free = [0, 1, 2].filter((l) => !blocked.has(l));
  if (!free.length) return run.lane;

  const pickups = run.pickups.filter((p) => !p.dead && !p.resolved && p.z > 0 && p.z < 26 && free.includes(p.lane));
  const scoreOf = (lane) => {
    let s = 0;
    for (const p of pickups) if (p.lane === lane) s += p.kind === 'gem' ? 3 : 2;
    return s;
  };

  // 当前道安全 → 默认守住（带滞后，防振荡），仅被明显更优的拾取物勾走
  if (free.includes(run.lane)) {
    let best = run.lane;
    let bestScore = scoreOf(run.lane);
    for (const l of free) {
      const s = scoreOf(l);
      if (s > bestScore) { bestScore = s; best = l; }
    }
    return best;
  }

  // 当前道被堵 → 去最近的安全道里拾取物最多的那一条
  let best = free[0];
  let bestScore = scoreOf(best) - Math.abs(best - run.lane) * 0.2;
  for (const l of free) {
    const s = scoreOf(l) - Math.abs(l - run.lane) * 0.2;
    if (s > bestScore) { bestScore = s; best = l; }
  }
  return best;
}

function shouldStop(run) {
  for (const o of run.obstacles) {
    if (o.kind === 'gate' && !o.dead && !o.resolved && o.state === 'red' && o.z > 0 && o.z <= GATE.ZONE_M) {
      return true;
    }
  }
  return false;
}

// greedy：连续转向模型（steer 0..2 浮点 = 手的横向位置，向目标车道 + 生理震颤/轻摆），贴近真实触屏。
// steer 不夹紧（手可略过界），只有映射到车道时才夹紧 → 稳定不抖动且每 tick 都有微调。
function greedyInput(run) {
  const target = greedyTarget(run);
  const steer = target + Math.sin(run.time * 6) * 0.25 + (greedyNoise() - 0.5) * 0.04;
  return { lane: Math.round(clamp(steer, 0, 2)), stop: shouldStop(run), steer };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let steer = 1.0;
  return (run) => {
    if ((run._randTick = (run._randTick ?? 0) + 1) % 18 === 0) {
      const t = Math.floor(rng() * 3);
      steer = clamp(steer + clamp(t - steer, -1.2, 1.2), 0, 2);
    }
    steer = clamp(steer + (rng() - 0.5) * 0.08, 0, 2);
    return { lane: Math.round(steer), stop: rng() < 0.03, steer };
  };
}

function noinput() {
  return { lane: null, stop: false, steer: null };
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
  let prevStop = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run) || {};
    run.step({ lane: input.lane, stop: !!input.stop });
    const sec = run.time;

    if (firstInputSec < 0 && (input.steer != null || input.stop)) firstInputSec = sec;

    const steerChanged = input.steer != null && (prevSteer == null || Math.abs(input.steer - prevSteer) > 0.0005);
    const stopToggled = !!input.stop !== prevStop;
    if (steerChanged || stopToggled) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !steerChanged && !stopToggled && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevSteer = input.steer;
    prevStop = !!input.stop;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'gem' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.stationReached,
    completed: run.phase !== 'dead',
    distance: Math.floor(run.distance),
    gems: run.gems,
    smoothTransfers: run.smoothTransfers,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(st=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,gems=${r.gems},apm=${Math.round(r.actions / Math.max(1e-6, r.durationSec) * 60)},idle=${Math.round((r.idleSec / Math.max(1e-6, r.durationSec)) * 100)}%,ev=${r.uniqueEvents},gap=${r.maxEventGapSec})`).join('  '));
