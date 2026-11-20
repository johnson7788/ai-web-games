// BALL ORBIT · 无头自玩：3 策略（greedy / random / noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, CANNON, BALL, ASTEROID, PLANET, clamp } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 一串流星轨迹模拟（只读 run，用于 greedy 评估角度） ----------
// 优化目标 = 这一串能「击碎」多少硬度 + 优先清低处威胁 + 彗星打盾
function simulateVolley(run, angle) {
  const n = Math.min(9, run.ballsPerShot + (run.comets > 0 ? 1 : 0));
  const dmg = new Map(); // asteroidId -> 本串累计伤害
  const dt = 1 / 60;
  let brokenHardness = 0;
  let addBallGain = 0;
  let shieldBroken = 0;

  for (let b = 0; b < n; b += 1) {
    const isComet = run.comets > 0 && b === 0;
    const impact = isComet ? 3 : 1;
    let x = CANNON.X;
    let y = CANNON.BALL_Y;
    let vx = Math.sin(angle) * BALL.SPEED;
    let vy = -Math.cos(angle) * BALL.SPEED;

    for (let i = 0; i < 340; i += 1) {
      vy += BALL.GRAVITY * dt;
      for (const p of run.planets) {
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > PLANET.INFLUENCE * PLANET.INFLUENCE) continue;
        const d = Math.sqrt(d2) || 1;
        const acc = Math.min(PLANET.MAX_ACC, p.gm / Math.max(d2, p.r * p.r));
        vx += (dx / d) * acc * dt;
        vy += (dy / d) * acc * dt;
      }
      x += vx * dt;
      y += vy * dt;
      if (x < BALL.R) { x = BALL.R; vx = Math.abs(vx); }
      else if (x > WORLD.WIDTH - BALL.R) { x = WORLD.WIDTH - BALL.R; vx = -Math.abs(vx); }
      if (y < BALL.R) { y = BALL.R; vy = Math.abs(vy); }
      if (y > WORLD.HEIGHT + BALL.R) break;

      for (const a of run.asteroids) {
        const ax = a.x + a.ox;
        const left = ax - ASTEROID.W / 2;
        const right = ax + ASTEROID.W / 2;
        const top = a.y - ASTEROID.H / 2;
        const bottom = a.y + ASTEROID.H / 2;
        const cx = clamp(x, left, right);
        const cy = clamp(y, top, bottom);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy >= BALL.R * BALL.R) continue;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const dot = vx * nx + vy * ny;
        if (dot < 0) { vx -= 2 * dot * nx; vy -= 2 * dot * ny; }
        x = cx + nx * BALL.R;
        y = cy + ny * BALL.R;

        if (a.kind === 'shield' && !isComet) break;
        const prev = dmg.get(a.id) || 0;
        const next = prev + impact;
        dmg.set(a.id, next);
        const threat = (a.y / ASTEROID.DANGER_Y) * 12;
        if (a.kind === 'addBall') {
          if (prev === 0) addBallGain += 20;
        } else if (prev < a.hardness && next >= a.hardness) {
          brokenHardness += a.initial + threat;
          if (a.kind === 'shield') shieldBroken += 20;
        }
        break;
      }
    }
  }
  return brokenHardness + addBallGain + shieldBroken;
}

function bestAimAngle(run) {
  let best = 0;
  let bestScore = -Infinity;
  for (let k = -12; k <= 12; k += 1) {
    const angle = (k / 12) * 1.1;
    const s = simulateVolley(run, angle);
    if (s > bestScore) { bestScore = s; best = angle; }
  }
  return best;
}

// ---------- 策略 ----------
function makeGreedy(rng) {
  const bot = { aim: 0, target: 0 };
  return (run) => {
    const canFire = run.canFire && run.balls.length === 0 && run.pending.length === 0;
    if (canFire) bot.target = bestAimAngle(run);
    const toward = clamp(bot.target - bot.aim, -0.2, 0.2);
    const tremor = (rng() - 0.5) * 0.05;
    bot.aim = Math.abs(bot.target - bot.aim) > 0.03 ? bot.aim + toward : bot.aim + tremor;
    return { aimAngle: bot.aim, fire: canFire };
  };
}

function makeRandom(rng) {
  let angle = 0;
  return (run, tick) => {
    if (tick % 20 === 0) angle = (rng() - 0.5) * 2 * 1.1;
    const canFire = run.canFire && run.balls.length === 0 && run.pending.length === 0;
    return { aimAngle: angle, fire: canFire && rng() < 0.8 };
  };
}

function noinput() {
  return { aimAngle: null, fire: false };
}

// ---------- 跑一局 ----------
function play(name, strategy, seed) {
  const run = createRun({ seed });
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const inputFor = strategy(rng);
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let prevAim = null;
  let prevFire = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.aimAngle != null || input.fire)) firstInputSec = sec;

    const aimChanged = input.aimAngle != null && (prevAim == null || Math.abs(input.aimAngle - prevAim) > 0.02);
    const fireToggled = !!input.fire !== prevFire;
    if (aimChanged || fireToggled) actions += 1;
    const tickEvents = run.drainEvents();
    const idle = !input.fire && !aimChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevAim = input.aimAngle;
    prevFire = !!input.fire;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'asteroidBreak' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    maxScore: Math.floor(run.score),
  };
}

// ---------- 写文件 ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const strategies = [
  { name: 'greedy', strategy: makeGreedy, seed: 123 },
  { name: 'random', strategy: makeRandom, seed: 456 },
  { name: 'noinput', strategy: () => noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.strategy, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.levelsReached},score=${r.maxScore},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
