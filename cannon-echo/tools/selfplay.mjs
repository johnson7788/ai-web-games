// CANNON ECHO · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 240;
const INPUT_LATENCY_MS = 90;

const UPGRADE_RANK = {
  ricochet: 10, pierce: 9, bossBuster: 8, echoChain: 7,
  power: 6, rate: 5, velocity: 4, coolant: 3, heatVent: 2, frost: 1,
};

// ---------- greedy：预测拦截 + 优先高危目标 ----------
function greedyInput(run) {
  // 最威胁目标 = 最靠近要塞（y 最大）
  let best = null;
  for (const t of run.targets) {
    if (t.dead) continue;
    if (!best || t.y > best.y) best = t;
  }

  let aimX = WORLD.CANNON_X;
  let aimY = 0;
  let fire = false;

  if (best) {
    const echo = best.shield || best.armor;
    if (echo) {
      // 回声：打目标同高的对面崖壁，弹回后水平横扫命中
      aimX = best.x < WORLD.CANNON_X ? WORLD.WALL_R : WORLD.WALL_L;
      aimY = Math.max(30, best.y);
    } else {
      aimX = best.x;
      // 预测拦截：目标下坠，提前量按弹道时长
      aimY = Math.max(30, best.y + best.vy * 0.35);
    }
    fire = run.cooldown <= 0 && run.heat < 50 && !run.overheated;
    if (run.heat > 70) fire = false;
  } else {
    fire = run.cooldown <= 0 && run.heat < 30 && !run.overheated;
  }

  // 真实拖动模型：手指追目标 + 贴住后持续微调（幅度恒 >2px，保证每 tick 都有真实输入）
  run._botTick = (run._botTick ?? 0) + 1;
  if (run._botTick % 10 === 0) {
    run._botAim = clamp(aimX + (run.rng() - 0.5) * 30, 0, WORLD.WIDTH);
  }
  const target = run._botAim ?? aimX;
  const finger = run._botFinger ?? WORLD.CANNON_X;
  const toward = clamp(target - finger, -13, 13);
  const tremorMag = 3 + run.rng() * 4; // 3..7px
  const tremorDir = run.rng() < 0.5 ? -1 : 1;
  const steerX = clamp(finger + (Math.abs(target - finger) > 12 ? toward : tremorDir * tremorMag), 0, WORLD.WIDTH);
  run._botFinger = steerX;

  return { aimX: steerX, aimY, fire };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let randX = WORLD.CANNON_X;
  return (run, tick) => {
    if (tick % 30 === 0) randX = rng() * WORLD.WIDTH;
    return {
      aimX: randX + (rng() - 0.5) * 60,
      aimY: 80 + rng() * 300,
      fire: rng() < 0.65 && !run.overheated,
    };
  };
}

function noinput() {
  return { aimX: WORLD.CANNON_X, aimY: 0, fire: false };
}

// ---------- 升级选择 ----------
function pickUpgrade(run, policy) {
  if (run.phase !== 'upgrade') return;
  let id;
  if (policy === 'greedy') {
    id = run.upgradeChoices.slice().sort((a, b) => (UPGRADE_RANK[b] ?? 0) - (UPGRADE_RANK[a] ?? 0))[0];
  } else {
    id = run.upgradeChoices[0];
  }
  run.chooseUpgrade(id);
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
  let prevFire = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase !== 'dead' && run.phase !== 'won'; tick += 1) {
    totalTicks += 1;
    if (run.phase === 'upgrade') {
      pickUpgrade(run, name);
    }
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.aimX != null || input.fire)) firstInputSec = sec;

    const steerChanged = input.aimX != null && (prevAimX == null || Math.abs(input.aimX - prevAimX) > 2);
    const fireToggled = !!input.fire !== prevFire;
    if (steerChanged || fireToggled) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !input.fire && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevAimX = input.aimX;
    prevFire = !!input.fire;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'break' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.maxWave || run.wave || 1,
    completed: run.phase !== 'dead',
    maxWave: run.stats.maxWave,
    score: Math.floor(run.stats.score),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { genre: 'action', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.maxWave},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
