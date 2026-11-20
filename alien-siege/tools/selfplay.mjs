// ALIEN SIEGE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { clamp, normAngle } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 策略：inputFor(run, tick) → { moveX, moveY, turn, shoot, reload, shield, mark } ----------
function nearestEnemy(run) {
  const p = run.player;
  let best = null;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (!best || d < best.d) best = { e, d };
  }
  return best;
}

function greedyInput(run, tick) {
  const p = run.player;
  const near = nearestEnemy(run);
  let turn = 0;
  let shoot = false;
  let moveX = 0;
  let moveY = 0;
  let shield = false;
  let mark = false;

  if (near) {
    const angleTo = Math.atan2(near.e.y - p.y, near.e.x - p.x);
    const diff = normAngle(angleTo - p.angle);
    turn = clamp(diff * 5, -1, 1);
    if (Math.abs(diff) < 0.075) shoot = true;

    // 背墙打近敌：离最近敌人太近则后退并开盾；中等距离后退拉开；远则侧移找角度
    if (near.d < 2.4) {
      moveY = -1;
      shield = p.shieldEnergy > 30;
    } else if (near.d < 4.2) {
      moveY = -0.6;
    } else {
      moveX = Math.sin(run.time * 1.4 + p.angle) * 0.5;
    }

    // 对厚敌/母巢上标记，集火
    if (p.markCooldown <= 0 && (near.e.type === 'behemoth' || near.e.type === 'nest') && near.d < 7) {
      mark = true;
    }
  } else {
    turn = 0.6; // 无敌人时扫描
  }

  return { moveX, moveY, turn, shoot, reload: false, shield, mark };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run, tick) => {
    if (rng() < 0.45) {
      // 周期性原地不动，让敌人追上（保证 random 会死）
      return { moveX: 0, moveY: 0, turn: 0, shoot: false, reload: false, shield: false, mark: false };
    }
    return {
      moveX: rng() * 2 - 1,
      moveY: rng() * 2 - 1,
      turn: rng() * 2 - 1,
      shoot: false,
      reload: false,
      shield: false,
      mark: false,
    };
  };
}

function noinput() {
  return { moveX: 0, moveY: 0, turn: 0, shoot: false, reload: false, shield: false, mark: false };
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
  let prev = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.turn !== 0 || input.shoot || input.moveX !== 0 || input.moveY !== 0 || input.shield || input.mark)) {
      firstInputSec = sec;
    }

    // 有效操作：输入相对上一帧发生有意义变化
    const cur = [input.moveX, input.moveY, input.turn, input.shoot, input.shield, input.mark];
    if (prev) {
      const changed = cur.some((v, i) => {
        const a = typeof v === 'boolean' ? (v ? 1 : 0) : v;
        const b = typeof prev[i] === 'boolean' ? (prev[i] ? 1 : 0) : prev[i];
        return Math.abs(a - b) > 0.05;
      });
      if (changed) actions += 1;
    }
    prev = cur;

    const tickEvents = run.drainEvents();
    const idle = !(cur.some((v) => (typeof v === 'boolean' ? v : Math.abs(v) > 0.01))) && tickEvents.length === 0;
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
    maxWave: run.stats.bestWave || run.wave || 1,
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
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run, tick), seed: 123 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(wave=${r.maxWave},dead=${r.deaths},kills firstSuccess=${r.firstSuccessSec}s,dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
