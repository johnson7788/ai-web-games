// SAUCER STRIKE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { GUN, PROJ } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 贪心 bot：预测拦截点 + 按紧迫度选目标 ----------
function saucerVelocity(s) {
  const next = s.path[s.wayIndex + 1];
  if (!next) return { vx: 0, vy: 0 };
  const d = Math.hypot(next.x - s.x, next.y - s.y) || 1;
  return { vx: ((next.x - s.x) / d) * s.speed, vy: ((next.y - s.y) / d) * s.speed };
}

function remainingDist(s) {
  let d = 0;
  for (let i = s.wayIndex + 1; i < s.path.length; i += 1) {
    const a = s.path[i - 1];
    const b = s.path[i];
    d += Math.hypot(b.x - a.x, b.y - a.y);
  }
  // 当前段剩余
  const next = s.path[s.wayIndex + 1];
  if (next) d -= 0; // 用累计近似即可
  return d;
}

function greedyAim(run) {
  // 挑最紧迫的可见碟（剩余路程最短 = 最早逃逸）
  let target = null;
  let bestUrgency = Infinity;
  for (const s of run.saucers) {
    if (!s.active) continue;
    if (s.invisible && !run.tracerActive) continue;
    const rem = remainingDist(s) / s.speed;
    if (rem < bestUrgency) { bestUrgency = rem; target = s; }
  }
  if (!target) return { aimX: GUN.MUZZLE_X, aimY: GUN.MUZZLE_Y - 120, charging: true, fire: false, tracer: false, power: 0.5 };

  const power = target.hp >= 3 ? 0.9 : (target.hp >= 2 ? 0.85 : 0.45);
  const speed = GUN.MIN_SPEED + power * (GUN.MAX_SPEED - GUN.MIN_SPEED);
  const sv = saucerVelocity(target);
  const dx = target.x - GUN.MUZZLE_X;
  const dy = target.y - GUN.MUZZLE_Y;
  const distNow = Math.hypot(dx, dy);
  const t = distNow / Math.max(1, speed);
  const px = target.x + sv.vx * t;
  const py = target.y + sv.vy * t;
  const ang = Math.atan2(py - GUN.MUZZLE_Y, px - GUN.MUZZLE_X);
  // 拖拽距离 = 力度 * MAX_POWER_DIST
  const aimX = GUN.MUZZLE_X + Math.cos(ang) * power * GUN.MAX_POWER_DIST;
  const aimY = GUN.MUZZLE_Y + Math.sin(ang) * power * GUN.MAX_POWER_DIST;
  return { aimX, aimY, charging: true, fire: false, tracer: false, power };
}

function greedyInput(run, tick) {
  const a = greedyAim(run);
  a.fire = tick % 9 === 0;
  // 隐形碟在场且未显形且有曳光弹 → 用曳光
  const hasInvisible = run.saucers.some((s) => s.invisible && s.active);
  a.tracer = hasInvisible && !run.tracerActive && run.tracersLeft > 0;
  return a;
}

function pickUpgrade(run) {
  const order = ['pierce', 'magnet', 'damage', 'rapid', 'coolant', 'coolRate', 'radar', 'tracerPlus', 'lives', 'comboBank', 'split'];
  for (const id of order) {
    const i = run.upgradeOffers.indexOf(id);
    if (i >= 0) return i;
  }
  return 0;
}

function makeRandomStrategy(seed) {
  const rng = (() => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  let aimX = 640;
  let aimY = 300;
  return (run, tick) => {
    if (tick % 18 === 0) {
      const ang = -Math.PI / 2 + (rng() - 0.5) * 2.4;
      const power = 0.3 + rng() * 0.6;
      aimX = GUN.MUZZLE_X + Math.cos(ang) * power * GUN.MAX_POWER_DIST;
      aimY = GUN.MUZZLE_Y + Math.sin(ang) * power * GUN.MAX_POWER_DIST;
    }
    return { aimX, aimY, charging: true, fire: tick % 24 === 0, tracer: false };
  };
}

function noinput() {
  return { aimX: 640, aimY: 300, charging: false, fire: false, tracer: false };
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
  let prevAimX = null;
  let prevAimY = null;
  let prevFire = false;
  let prevTracer = false;
  let prevUpgrade = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};

    // 升级三选一（贪心 bot 才有 pendingUpgrade；random/noinput 自动选 0 防卡）
    if (run.pendingUpgrade) {
      run.chooseUpgrade(name === 'greedy' ? pickUpgrade(run) : 0);
      actions += 1;
    }

    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.charging || input.fire || input.tracer)) firstInputSec = sec;

    const aimChanged = input.charging && (prevAimX == null || Math.hypot(input.aimX - prevAimX, input.aimY - prevAimY) > 2);
    const fireEdge = !!input.fire && !prevFire;
    const tracerEdge = !!input.tracer && !prevTracer;
    if (aimChanged || fireEdge || tracerEdge) actions += 1;
    prevAimX = input.aimX;
    prevAimY = input.aimY;
    prevFire = !!input.fire;
    prevTracer = !!input.tracer;

    const tickEvents = run.drainEvents();
    const idle = !input.charging && !input.fire && !input.tracer && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'kill' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.waveReached || run.wave || 1,
    completed: run.phase !== 'dead',
    score: run.score,
    wave: run.wave,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
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
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.wave},dead=${r.deaths},dur=${r.durationSec}s,apm=${r.actionsPerMin})`).join('  '));
console.log('autoplay.json records:', all.length);
