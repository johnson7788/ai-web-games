// COLOR FLUX · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun, nextMatchCenter } from '../src/game/sim.js';
import { BALL, RING, WORLD, PROGRESS } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 180;
const INPUT_LATENCY_MS = 90; // 遥测常量

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// 下一个会穿越的障碍（未通过、从上方接近、最靠近球）
function nextObstacle(run) {
  let best = null;
  for (const o of run.obstacles) {
    if (o.passed) continue;
    if (o.y > run.ball.y + RING.PASS_BAND + 10) continue;
    if (!best || o.y > best.y) best = o;
  }
  return best;
}

// greedy：预测下一道环的匹配穿越高度，把球驱动到那里并悬浮等待（真实 tap/hold 输入）
function greedyInput(run) {
  const b = run.ball;
  const now = run.time;
  const scroll = run.scroll;
  const next = nextObstacle(run);
  if (!next) return { jump: b.mode === 'falling' && b.y > 560, hover: false };

  let Hc = null;
  let base = now;
  for (let k = 0; k < 6; k += 1) {
    const tc = nextMatchCenter(next, b.color, base);
    if (tc == null) break;
    const h = next.y + scroll * (tc - now);
    base = tc + 0.001;
    if (h >= 90 && h <= 560) {
      const dist = Math.abs(b.y - h);
      const spd = h < b.y ? BALL.V_RISE : BALL.V_FALL;
      if (dist / spd <= (tc - now) - 0.35) { Hc = h; break; }
    }
  }
  if (Hc == null) {
    const tc = nextMatchCenter(next, b.color, now);
    Hc = tc != null ? clamp(next.y + scroll * (tc - now), 90, 560) : 300;
  }

  if (b.y > Hc + 12) return { jump: true, hover: false };
  if (b.y < Hc - 12) return { jump: false, hover: false };
  return { jump: false, hover: true };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let jumpTick = 0;
  let hover = false;
  return (run, tick) => {
    if (tick % 20 === 0) hover = rng() < 0.3;
    if (tick % 14 === 0 && rng() < 0.6) jumpTick = tick;
    return { jump: tick === jumpTick, hover };
  };
}

function noinput() {
  return { jump: false, hover: false };
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
  let prevHover = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    const jump = !!input.jump;
    const hover = !!input.hover;
    run.step({ jump, hover });
    const sec = run.time;

    if (firstInputSec < 0 && (jump || hover)) firstInputSec = sec;

    const hoverToggled = hover !== prevHover;
    // 有效操作 = 起跳 + 悬浮状态切换（供 actionsPerMin）
    if (jump || hoverToggled) actions += 1;
    prevHover = hover;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入动作（含按住悬浮）、也无任何游戏反馈事件
    const acted = jump || hover;
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'pass' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    levelsReached: run.stats.segmentReached,
    completed: run.phase !== 'dead',
    score: Math.floor(run.score),
    ringsPassed: run.ringsPassed,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: greedyInput, seed: 789 },
  { name: 'random', inputFor: randomInput, seed: 456 },
  { name: 'noinput', inputFor: noinput, seed: 123 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(seg=${r.levelsReached},rings=${r.ringsPassed},dead=${r.deaths},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
