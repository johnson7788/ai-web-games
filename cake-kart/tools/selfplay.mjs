// CAKE KART · 无头自玩：3 策略（greedy/random/noinput）各跑一局（站 7 · 3 圈）。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const STATION = 7;          // 3 圈站（greedy 必须完成 3 圈）
const MAX_SEC = 240;        // 单局上限，防贪心 bot 永续
const INPUT_LATENCY_MS = 90;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ---------- greedy：中线 + 弯前漂移，走内线 ----------
function greedyInput(run) {
  const s = run.track.sampleAt(run.player.progress);
  const look = run.track.sampleAt((run.player.progress + Math.max(60, run.player.speed * 0.9)) % run.track.length);
  const inside = -Math.sign(look.curvature) * 0.12 * s.halfWidth;
  const err = inside - run.player.lane;
  const steer = clamp(err * 0.14, -1, 1);
  const sharp = Math.abs(look.curvature) > 0.0015;
  return { steer, throttle: 1, drift: sharp, item: false };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let steer = 0;
  let throttle = 1;
  let drift = false;
  let item = false;
  return (run, tick) => {
    if (tick % 25 === 0) steer = (rng() - 0.5) * 2;
    if (tick % 60 === 0) throttle = rng() < 0.7 ? 1 : 0;
    if (tick % 40 === 0) drift = rng() < 0.35;
    if (tick % 30 === 0) item = rng() < 0.12;
    return { steer, throttle, drift, item };
  };
}

function noinput() {
  return { steer: 0, throttle: 0, drift: false, item: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, station: STATION });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let prev = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'racing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    const active = input.throttle > 0 || Math.abs(input.steer) > 0.01 || input.drift || input.item;
    if (firstInputSec < 0 && active) firstInputSec = sec;

    // 真实操作模型：转向连续微调计一次动作；漂移/油门/道具边沿各计一次
    const steerChanged = prev == null || Math.abs((input.steer ?? 0) - (prev.steer ?? 0)) > 0.01;
    const driftToggled = !!input.drift !== !!prev?.drift;
    const throttleToggled = (input.throttle > 0) !== (prev ? prev.throttle > 0 : false);
    const itemUsed = !!input.item && !prev?.item;
    if (steerChanged || driftToggled || throttleToggled || itemUsed) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !active && !steerChanged && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prev = { steer: input.steer ?? 0, throttle: input.throttle ?? 0, drift: !!input.drift, item: !!input.item };

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'lap' && e.kart === 'player' && firstSuccessSec == null) firstSuccessSec = sec;
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
    firstSuccessSec: firstSuccessSec == null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.stats.deaths,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.player.lap,
    completed: run.phase === 'finished',
    laps: run.player.lap,
    rank: run.player.rank,
    boosts: run.stats.boosts,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

// ---------- 写文件（整批替换，保持 fun-report 的 {runs:[...]} schema） ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
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
console.log('strategies:', records.map((r) => `${r.policy}(lap=${r.laps},rank=${r.rank},deaths=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
