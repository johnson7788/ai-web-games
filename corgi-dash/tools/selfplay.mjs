// CORGI DASH · 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, PLAYER, WHISTLE } from '../config/gameplay.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- greedy：检测最近障碍决定跳时机 ----------
function greedyInput(run) {
  const p = run.player;
  const px = WORLD.PLAYER_X;
  const speed = run.speed;
  const lead = speed * 0.52; // 半程空中时间对应的水平提前量

  let target = null;
  for (const o of run.obstacles) {
    if (o.cleared) continue;
    const sx = o.x - run.scrollX;
    if (sx + o.w < px - PLAYER.W / 2) continue; // 已甩在身后
    if (!target || sx < target.x - run.scrollX) target = o;
  }

  const out = { jump: false, jumpPressed: false, whistle: false };

  // 口哨：遇到横排（3 连障碍）且羊群较大时散开保护
  if (target && target.kind === 'row' && run.flock >= 4 && run.whistleCd <= 0) {
    out.whistle = true;
  }

  if (target && target.kind !== 'bridge') {
    const sx = target.x - run.scrollX;
    const gap = sx - px; // 正 = 在前方
    const jitter = (run.rng() - 0.5) * 46;
    if (gap < lead + jitter && gap > -34) {
      if (p.onGround) {
        out.jumpPressed = true;
        out.jump = true;
      } else if (p.jumpsLeft > 0 && gap < (lead + jitter) * 0.4) {
        out.jumpPressed = true;
        out.jump = true;
      }
    }
  } else if (target && target.kind === 'bridge') {
    // 桥洞：贴地通过，不跳
    out.jump = false;
  }

  return out;
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  let hold = 0;
  return (run) => {
    if (hold > 0) { hold -= 1; return { jump: rng() < 0.5, jumpPressed: false, whistle: false }; }
    if (rng() < 0.16) { hold = Math.floor(rng() * 14); return { jump: true, jumpPressed: true, whistle: false }; }
    if (rng() < 0.03) return { jump: false, jumpPressed: false, whistle: true };
    return { jump: false, jumpPressed: false, whistle: false };
  };
}

function noinput() {
  return { jump: false, jumpPressed: false, whistle: false };
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
  let prevJump = false;
  let prevWhistle = false;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input);
    const sec = run.time;

    if (firstInputSec < 0 && (input.jumpPressed || input.whistle)) firstInputSec = sec;

    const jumpToggled = !!input.jumpPressed !== prevJump;
    const whistleToggled = !!input.whistle !== prevWhistle;
    if (jumpToggled || whistleToggled) actions += 1;
    prevJump = !!input.jumpPressed;
    prevWhistle = !!input.whistle;

    const tickEvents = run.drainEvents();
    const idle = !input.jumpPressed && !input.whistle && !jumpToggled && !whistleToggled && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (firstSuccessSec < 0 && (e.type === 'sheepGain' || e.type === 'perfectLand')) firstSuccessSec = sec;
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
    levelsReached: run.stats.segmentReached || run.segment || 1,
    completed: run.phase !== 'dead',
    maxScore: Math.floor(run.stats.score),
    maxFlock: run.stats.maxFlock,
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
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(run), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(seg=${r.levelsReached},score=${r.maxScore},dead=${r.deaths},dur=${r.durationSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
