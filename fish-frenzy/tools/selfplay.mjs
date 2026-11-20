// FISH FRENZY · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, captureRate } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// 期望收益/币 = value/hp（与捕获率公式无关），greedy 据此选目标
function profitPerCoin(f) {
  return f.value / Math.max(1, f.hp);
}

function recommendedTier() {
  // 期望收益/币 = value × 捕获率，捕获率随档位单调升 → 高档永远是更优的期望
  return 7;
}

function bestTarget(run) {
  let best = null;
  for (const f of run.fish) {
    if (!f.alive || f.delay > 0) continue;
    // 只打屏幕内（或即将入屏）的鱼，避免朝屏外浪费金币
    if (f.x < -30 || f.x > 1310) continue;
    // 只打期望收益为正（value/hp > 1）的鱼；小鱼是诱饵，打它反而亏
    if (profitPerCoin(f) <= 1.0) continue;
    if (!best || profitPerCoin(f) > profitPerCoin(best)) best = f;
  }
  return best;
}

function greedyInput(run, tick, bot) {
  const target = bestTarget(run);
  if (target) {
    // 真实瞄准：手指以有限速度追目标 + 生理震颤（bot 自带 rng，不碰 sim rng）
    const aim = bot.aim || { x: WORLD.WIDTH / 2, y: 240 };
    const dx = target.x - aim.x;
    const dy = target.y - aim.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 1500;
    const tremor = (bot.rng() - 0.5) * 10;
    const nx = Math.max(0, Math.min(WORLD.WIDTH, aim.x + (d > 15 ? (dx / d) * speed * STEP : tremor)));
    const ny = Math.max(20, Math.min(680, aim.y + (d > 15 ? (dy / d) * speed * STEP : tremor)));
    bot.aim = { x: nx, y: ny };

    // 电击网：充能满且屏上鱼 >=3 时群捕
    const electric = run.electricCharge >= 1 && run.fish.filter((f) => f.alive).length >= 3;

    // 只有瞄准到位才发射（真实操作：先对准再扣扳机），避免朝移动目标身后空放
    return {
      aimX: nx,
      aimY: ny,
      fire: d <= 60,
      tier: recommendedTier(target),
      electric,
    };
  }
  // 无目标：扫视水面（连续微调瞄准），不发射，避免空耗金币也避免死时间
  const t = tick * STEP;
  const sweepX = WORLD.WIDTH / 2 + Math.sin(t * 1.4) * 420;
  const sweepY = 220 + Math.sin(t * 0.9) * 120;
  bot.aim = { x: sweepX, y: sweepY };
  return { aimX: sweepX, aimY: sweepY, fire: false, tier: 1, electric: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let x = WORLD.WIDTH / 2;
  let y = 240;
  return (run, tick) => {
    if (tick % 20 === 0) {
      x = rng() * WORLD.WIDTH;
      y = 60 + rng() * 500;
    }
    const tier = 1 + Math.floor(rng() * 7);
    return { aimX: x, aimY: y, fire: rng() < 0.6, tier, electric: rng() < 0.03 };
  };
}

function noinput() {
  return { aimX: WORLD.WIDTH / 2, aimY: 240, fire: false, tier: 1, electric: false };
}

function play(name, inputFor, seed) {
  const run = createRun({ seed });
  const maxTicks = Math.round(MAX_SEC / STEP);
  const bot = { rng: mulberry32(seed ^ 0x9e3779b9), aim: null };

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
  let prevTier = 1;
  let prevFire = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick, bot) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.fire || input.aimX != null)) firstInputSec = sec;

    const aimMoved = input.aimX != null && (prevAimX == null || Math.abs(input.aimX - prevAimX) > 2 || Math.abs(input.aimY - prevAimY) > 2);
    const tierChanged = input.tier !== prevTier;
    const fireToggled = !!input.fire && !prevFire;
    if (aimMoved || tierChanged || fireToggled) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !input.fire && !input.electric && !aimMoved && !tierChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    prevAimX = input.aimX;
    prevAimY = input.aimY;
    prevTier = input.tier;
    prevFire = !!input.fire;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'catch' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.maxStageReached || run.stage || 1,
    completed: run.stats.won === true,
    maxStage: run.stats.maxStageReached,
    coins: Math.floor(run.coins),
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'fish-frenzy', genre: 'arcade', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);

const strategies = [
  { name: 'greedy', inputFor: (run, tick, bot) => greedyInput(run, tick, bot), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(stage=${r.maxStage},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
