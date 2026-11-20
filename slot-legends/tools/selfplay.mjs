// tools/selfplay.mjs — SLOT LEGENDS · 无头自玩：3 策略（greedy/random/noinput）
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
// schema 见 fun-report 硬校验：{ runs: [ { id, policy, durationSec, actions, firstInputSec,
//   inputLatencyMs, firstSuccessSec, deaths, idleSec, maxEventGapSec, uniqueEvents,
//   levelsReached, completed } ] }
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { STEP } from '../config/game.config.js';
import { BET_OPTIONS } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
function greedyInput(run) {
  // 固定最小注跑期望：只转最小注、不开押镖，纯靠期望推进到更高等级
  return { spin: run.phase === 'idle', stop: false, bet: BET_OPTIONS[0], escort: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  return (run) => {
    // 高注乱按：满注 + 随机停止 + 不开押镖（纯随机高注，必破产 → deathPresence）
    return { spin: run.phase === 'idle', stop: rng() < 0.12, bet: 100, escort: false };
  };
}

function noinput() {
  return { spin: false, stop: false, bet: BET_OPTIONS[0], escort: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed, maxSec) {
  const run = createRun({ seed });
  const maxTicks = Math.round(maxSec / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase !== 'dead'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const acted = !!input.spin;
    if (acted) {
      actions += 1;
      if (firstInputSec < 0) firstInputSec = sec;
    }

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既没输入动作、也没收到任何游戏反馈事件
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && ['win', 'bigWin', 'jackpot', 'freeSpin', 'pity'].includes(e.type)) {
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
    levelsReached: run.level,
    completed: run.phase !== 'dead',
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'slot-legends', genre: 'default', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run, tick) => greedyInput(run, tick), seed: 123, maxSec: 180 },
  { name: 'random', inputFor: (run, tick) => randomInput(run, tick), seed: 456, maxSec: 300 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789, maxSec: 30 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed, s.maxSec));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(level=${r.levelsReached},dead=${r.deaths},dur=${r.durationSec}s,idle=${r.idleSec}s,evt=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
