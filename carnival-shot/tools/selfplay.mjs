// CARNIVAL SHOT · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, MAGAZINE } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 360; // 单局上限 6 分钟（12 关理论最长 ~5.5min）
const INPUT_LATENCY_MS = 90;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------- 目标价值（greedy 用） ----------
function targetValue(t) {
  if (t.kind === 'ghost') return -9999; // 绝对不打
  if (t.kind === 'red') return 900;     // 优先追奖励鸭
  if (t.kind === 'golden') return 800;
  if (t.kind === 'moving') return 200;
  if (t.kind === 'lantern') return 150;
  if (t.kind === 'dive') return 130;
  return t.points ?? 100;
}

// ---------- greedy：sim 级瞄准模型 ----------
function greedyInput(run) {
  const aim = run._botAim || { x: WORLD.WIDTH / 2, y: 200 };
  run._botTick = (run._botTick ?? 0) + 1;

  let best = null;
  let bestScore = -Infinity;
  for (const t of run.targets) {
    if (t.dead) continue;
    let s = targetValue(t) - Math.abs(t.x - aim.x) * 0.15 - Math.abs(t.y - aim.y) * 0.15;
    if (s > bestScore) { bestScore = s; best = t; }
  }

  // 真实操作模型：手指连续追踪 + 持续生理震颤（每 tick 都微调，不是 settle-and-hold）
  const tx = best ? best.x : aim.x;
  const ty = best ? best.y : aim.y;
  const dir = (run._botTick % 2 === 0) ? 1 : -1;
  const mag = 3 + run.rng() * 4; // 3..7px 震颤幅度
  const ax = clamp(tx + dir * mag, 0, WORLD.WIDTH);
  const ay = clamp(ty + dir * mag * 0.7, 0, WORLD.HEIGHT);
  run._botAim = { x: ax, y: ay };

  let shoot = null;
  let reload = false;
  if (!run.reloading && run.ammo > 0 && best) {
    shoot = { x: best.x, y: best.y }; // 打目标中心，命中判定半径内必中
  } else if (!run.reloading && run.ammo > 0 && run.ammo < MAGAZINE.SIZE && !best) {
    reload = true; // 无目标时提前换弹装速装匣
  }

  return { aimX: ax, aimY: ay, shoot, reload };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let ax = 640;
  let ay = 200;
  return (run, tick) => {
    if (tick % 12 === 0) {
      ax = rng() * WORLD.WIDTH;
      ay = 60 + rng() * 500;
    }
    // 连续震颤
    const tremor = (rng() - 0.5) * 10;
    const x = clamp(ax + tremor, 0, WORLD.WIDTH);
    const y = clamp(ay + tremor, 0, WORLD.HEIGHT);
    const shoot = !run.reloading && run.ammo > 0 && tick % 20 === 0 ? { x, y } : null;
    const reload = !run.reloading && run.ammo > 0 && run.ammo < MAGAZINE.SIZE && tick % 90 === 0;
    return { aimX: x, aimY: y, shoot, reload };
  };
}

function noinput() {
  return { aimX: 640, aimY: 200, shoot: null, reload: false };
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
  let prevAimX = null;
  let prevAimY = null;
  let prevShoot = false;
  let prevReload = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.shoot || input.reload)) firstInputSec = sec;

    const aimChanged = (prevAimX == null || Math.abs(input.aimX - prevAimX) > 2 || Math.abs(input.aimY - prevAimY) > 2);
    const shootEdge = !!input.shoot !== prevShoot;
    const reloadEdge = !!input.reload !== prevReload;
    if (aimChanged || shootEdge || reloadEdge) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !input.shoot && !input.reload && !aimChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevAimX = input.aimX;
    prevAimY = input.aimY;
    prevShoot = !!input.shoot;
    prevReload = !!input.reload;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && (e.type === 'hit' || e.type === 'goldenHit')) firstSuccessSec = sec;
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
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},dead=${r.deaths},score=${r.score},dur=${r.durationSec}s,idle=${r.idleSec}s,gap=${r.maxEventGapSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
