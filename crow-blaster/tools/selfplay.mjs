// CROW BLASTER · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { LAUNCHER, BOLT, CROWS, clampAim } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 360;
const INPUT_LATENCY_MS = 90;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// 乌鸦价值（greedy 用，鬼鸦诱饵绝对不打）
function valueOf(c) {
  if (c.decoy || c.kind === 'ghost') return -9999;
  if (c.kind === 'golden') return 900;
  if (c.kind === 'tank') return 600;
  return c.points ?? 100;
}

// 弹道解算：暴力扫射角度，前向模拟能量弹，找与乌鸦（线性预测）最近的角度
function chooseAim(t) {
  const ox = LAUNCHER.X;
  const oy = LAUNCHER.Y - 10;
  const g = BOLT.GRAVITY;
  const v = BOLT.SPEED;
  let bestAim = 0;
  let bestDist = Infinity;
  for (let a = -60; a <= 60.001; a += 1.5) {
    const rad = a * Math.PI / 180;
    const vx = v * Math.sin(rad);
    let vy = -v * Math.cos(rad);
    let x = ox;
    let y = oy;
    let minD = Infinity;
    const steps = Math.ceil(BOLT.MAX_LIFE / STEP);
    for (let i = 0; i < steps; i += 1) {
      vy += g * STEP;
      x += vx * STEP;
      y += vy * STEP;
      const tt = (i + 1) * STEP;
      const px = t.x + t.vx * tt;
      const py = t.y + t.vy * tt;
      const d = Math.hypot(px - x, py - y);
      if (d < minD) minD = d;
    }
    if (minD < bestDist) { bestDist = minD; bestAim = a; }
  }
  return { aim: bestAim, dist: bestDist };
}

function simpleAim(t) {
  const dx = t.x - LAUNCHER.X;
  const dy = LAUNCHER.Y - t.y;
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

// ---------- greedy：追踪最高价值目标，冷却好了就弹道解算开火 ----------
function greedyInput(run, tick) {
  let best = null;
  let bestScore = -Infinity;
  for (const c of run.crows) {
    if (c.dead || c.decoy || c.kind === 'ghost') continue;
    if (c.x < 40 || c.x > WORLD.WIDTH - 40) continue;
    const val = valueOf(c) - Math.abs(c.x - LAUNCHER.X) * 0.05;
    if (val > bestScore) { bestScore = val; best = c; }
  }

  let aim = run._botAim ?? 0;
  let shoot = false;
  if (best) {
    if (run.cooldownT <= 0 && run.ammo > 0) {
      const sol = chooseAim(best);
      aim = sol.aim;
      if (sol.dist < best.r * 0.85) shoot = true;
    } else {
      aim = simpleAim(best);
    }
  } else {
    aim = clamp(aim + (tick % 2 ? 1.2 : -1.2), -60, 60);
  }
  aim = clampAim(aim + (tick % 2 ? 0.15 : -0.15)); // 微颤，贴近真实追踪
  run._botAim = aim;
  return { aim, shoot };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let aim = 0;
  return (run, tick) => {
    if (tick % 6 === 0) aim = (rng() * 120) - 60;
    aim = clampAim(aim + (rng() - 0.5) * 10);
    const shoot = tick % 7 === 0;
    return { aim, shoot };
  };
}

function noinput() {
  return { aim: 0, shoot: false };
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
  let prevAim = null;
  let prevShoot = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && input.shoot) firstInputSec = sec;

    const aimChanged = prevAim == null || Math.abs(input.aim - prevAim) > 0.1;
    const shootEdge = !!input.shoot !== prevShoot;
    if (aimChanged || shootEdge) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !input.shoot && !aimChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevAim = input.aim;
    prevShoot = !!input.shoot;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && (e.type === 'hit' || e.type === 'kill' || e.type === 'tankHit' || e.type === 'goldenHit')) {
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
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelReached || run.level || 1,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
    maxCombo: run.maxCombo,
    stars: run.stars,
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
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},score=${r.score},stars=${r.stars},dur=${r.durationSec}s,act=${r.actions},idle=${r.idleSec}s,gap=${r.maxEventGapSec}s,ev=${r.uniqueEvents},firstWin=${r.firstSuccessSec})`).join('  '));
console.log('autoplay.json records:', all.length);
