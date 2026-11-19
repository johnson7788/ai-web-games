// ELITE GUNSTRIKE · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';
import { clamp, BOLT, WORLD } from '../config/gameplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 180;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：优先近敌 + 重力补偿瞄准 + 节奏发射 ----------
function greedyInput(run) {
  const p = run.player;
  let tx = null;
  let ty = null;
  let bd = Infinity;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; tx = e.x; ty = e.y; }
  }

  const jx = (run.rng() - 0.5) * 8;
  const jy = (run.rng() - 0.5) * 8;
  let ax;
  let ay;
  if (tx == null) {
    // 无目标（过关结算/换章）：指针仍缓慢扫描，避免空转
    ax = clamp(640 + Math.sin(run.time * 2) * 220 + jx, 0, WORLD.WIDTH);
    ay = clamp(200 + Math.cos(run.time * 2.4) * 140 + jy, 0, WORLD.HEIGHT);
    return { aimX: ax, aimY: ay, fire: false };
  }

  const dist = Math.hypot(tx - p.x, ty - p.y) || 1;
  const t = dist / BOLT.SPEED;
  ax = clamp(tx + jx, 0, WORLD.WIDTH);
  ay = clamp(ty - 0.5 * BOLT.GRAVITY * t * t + jy, 0, WORLD.HEIGHT);

  const bot = run._bot || (run._bot = { charging: false, cd: 0 });
  let fire = false;
  if (run.time >= bot.cd) {
    if (!bot.charging) {
      bot.charging = true;
      fire = true;
    } else {
      bot.charging = false;
      fire = false;
      bot.cd = run.time + 0.45;
    }
  } else {
    bot.charging = false;
    fire = false;
  }
  return { aimX: ax, aimY: ay, fire };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let rx = 640;
  let ry = 300;
  let fire = false;
  return (run, tick) => {
    if (tick % 12 === 0) { rx = rng() * WORLD.WIDTH; ry = rng() * WORLD.HEIGHT; }
    if (tick % 9 === 0) fire = rng() < 0.55;
    return { aimX: rx + (rng() - 0.5) * 30, aimY: ry + (rng() - 0.5) * 30, fire };
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
  let prevAimX = null;
  let prevAimY = null;
  let prevFire = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const hasInput = input.aimX != null || input.fire;
    if (firstInputSec < 0 && hasInput) firstInputSec = sec;

    const aimChanged = input.aimX != null && (prevAimX == null || Math.abs(input.aimX - prevAimX) > 1 || Math.abs((input.aimY ?? 0) - (prevAimY ?? 0)) > 1);
    const fireToggled = !!input.fire !== prevFire;
    if (aimChanged || fireToggled) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !aimChanged && !fireToggled && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevAimX = input.aimX;
    prevAimY = input.aimY;
    prevFire = !!input.fire;

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
    levelsReached: run.stats.levelsReached || run.level || 1,
    completed: run.phase !== 'dead',
    maxRound: run.stats.levelsReached || run.level || 1,
    score: run.score,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ genre: 'action', runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,kill=${r.firstSuccessSec === null ? 'null' : r.firstSuccessSec + 's'},idle=${r.idleSec}s,gap=${r.maxEventGapSec}s,ev=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', records.length);
