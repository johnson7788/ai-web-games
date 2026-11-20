// EGG BOOM · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { EGG, ROWS, WORLD, screenXAt, doughYAt } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 贪心策略：同排有团就停下补枪（真实操作），空隙/小团靠自动射击兜底 ----------
function greedyInput(run) {
  const bot = run._bot || (run._bot = { shootCd: 0 });
  const egg = run.egg;
  if (bot.shootCd > 0) bot.shootCd -= 1;

  // 找蛋当前高度所在行前方威胁（与自动瞄准同视界，早于子弹削血）
  const ahead = run.doughs.filter((d) => {
    const sx = screenXAt(d.atDistance, run.distance);
    return sx > WORLD.EGG_X - 20 && sx < WORLD.EGG_X + 620;
  });
  const sameRow = ahead.filter((d) => Math.abs(doughYAt(d, run.time) - egg.y) < 74);

  let shoot = false;
  if (bot.shootCd === 0 && sameRow.length > 0 && egg.ammo > 5) {
    shoot = true;
    bot.shootCd = 12; // ~5 发/s 上限（sim 冷却 0.16s 再收紧）
  }

  return { charge: false, shoot };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let holdTicks = 0;
  let shootTick = 0;
  return (run) => {
    if (holdTicks > 0) {
      holdTicks -= 1;
      return { charge: holdTicks > 0, shoot: false };
    }
    if (rng() < 0.03) holdTicks = Math.floor(10 + rng() * 24);
    shootTick += 1;
    const shoot = rng() < 0.12 && shootTick % 2 === 0;
    return { charge: false, shoot };
  };
}

function noinput() {
  return { charge: false, shoot: false };
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
  let prevCharge = false;
  let prevShoot = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const hasInput = !!input.charge || !!input.shoot;
    if (firstInputSec < 0 && hasInput) firstInputSec = sec;

    const chargeToggled = !!input.charge !== prevCharge;
    const shootFired = !!input.shoot;
    if (chargeToggled || shootFired) actions += 1;
    prevCharge = !!input.charge;
    prevShoot = !!input.shoot;

    const tickEvents = run.drainEvents();
    const idle = !hasInput && !chargeToggled && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'doughBreak' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    completed: run.phase === 'won',
    maxScore: Math.floor(run.score),
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
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
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lv=${r.levelsReached},dead=${r.deaths},score=${r.maxScore},dur=${r.durationSec}s,apm=${r.actionsPerMin})`).join('  '));
console.log('autoplay.json records:', all.length);
