// tools/selfplay.mjs — FLAME CRAFT · M1 无头自玩：3 策略（greedy / random / noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
//
// 玩法是「横移接燃料/躲危险」：greedy 每 tick 评估最近的好物与逼近的危险，输出左/右；
// random 做随机游走；noinput 完全不动（被瞄准的火星击落，贡献 deathPresence）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { WORLD, PLAYER } from '../config/game.config.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

const P_Y = WORLD.GROUND_Y;

// ---------- greedy：躲危险 + 追最近的好物 ----------
function greedyInput(run) {
  const p = run.player.x;

  // 1) 危险逼近：远离最近、最靠下的危险物
  let threat = null; let threatY = -Infinity;
  for (const e of run.entities) {
    if (e.type !== 'water' && e.type !== 'spark') continue;
    if (e.y > P_Y - 420 && e.y < P_Y && e.y > threatY) { threat = e; threatY = e.y; }
  }
  if (threat && Math.abs(threat.x - p) < 110) {
    if (threat.x < p) return { right: true };
    return { left: true };
  }

  // 2) 追最近（最靠下）的好物，但若其正下方有危险则暂缓
  let best = null; let bestY = -Infinity;
  for (const e of run.entities) {
    if (e.type !== 'fuel' && e.type !== 'coal') continue;
    if (e.y < P_Y && e.y > bestY) { best = e; bestY = e.y; }
  }
  if (best) {
    // 目标下方若有危险逼近，先保命不冲
    for (const e of run.entities) {
      if (e.type !== 'water' && e.type !== 'spark') continue;
      if (e.y > best.y && Math.abs(e.x - best.x) < 90) { best = null; break; }
    }
  }
  if (best) {
    if (best.x < p - 10) return { left: true };
    if (best.x > p + 10) return { right: true };
  }

  // 3) 无目标：向中线收拢，扩大覆盖
  if (p < WORLD.WIDTH / 2 - 40) return { right: true };
  if (p > WORLD.WIDTH / 2 + 40) return { left: true };
  return {};
}

// ---------- random：随机游走（每 0.3~0.8s 换向） ----------
function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const st = { dir: 0, t: 0, next: 0.4 };
  return () => {
    st.t += STEP;
    if (st.t >= st.next) {
      st.t = 0;
      st.next = 0.3 + rng() * 0.5;
      const r = rng();
      st.dir = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
    }
    return st.dir < 0 ? { left: true } : st.dir > 0 ? { right: true } : {};
  };
}

const noinput = () => ({});

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, startLevel: 1 });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = null;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;
  let prevLeft = false; let prevRight = false;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run) || {};
    run.step(input);
    const sec = run.simTime;

    const acted = !!(input.left || input.right);
    // 行动数 = 方向改变的输入边沿 + 有效收集/闪避（代表「有意识的决策」）
    if (acted && (input.left !== prevLeft || input.right !== prevRight)) actions += 1;
    prevLeft = !!input.left; prevRight = !!input.right;
    if (firstInputSec < 0 && acted) firstInputSec = sec;

    const tickEvents = run.drainEvents();
    for (const e of tickEvents) {
      if (e.type === 'collect' || e.type === 'collectCoal' || e.type === 'dodge') actions += 1;
      if ((e.type === 'collect' || e.type === 'collectCoal') && firstSuccessSec === null) firstSuccessSec = sec;
    }

    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.simTime;
  return {
    id: `${name}-${seed}`,
    policy: name,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? 0 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec === null ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.phase === 'dead' ? 1 : 0,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase === 'win',
    finalLevel: run.level,
    finalScore: run.score,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'flame-craft', genre: 'arcade', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
  return records;
}

const randomInput = makeRandomStrategy(456);
const strategies = [
  { name: 'greedy', inputFor: (run) => greedyInput(run), seed: 123 },
  { name: 'random', inputFor: (run) => randomInput(), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.finalLevel},dead=${r.deaths},dur=${r.durationSec}s,acts=${r.actions},events=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
