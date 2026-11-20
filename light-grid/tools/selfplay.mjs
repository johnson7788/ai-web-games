// tools/selfplay.mjs — LIGHT GRID · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
//
// 遥测口径（对齐 fun-report）：
//   - 输入动作 = 该 tick 有 hover（连续瞄准/震颤）或 press（点击）→ 有输入就不算空转
//   - 空转 = 该 tick 既无输入动作、也无任何游戏事件
//   - greedy 用内置生成解连续瞄准并逐步点击，推进到第 4 关即停
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 120;
const INPUT_LATENCY_MS = 90;
const PRESS_EVERY = 12; // 每 12 tick（0.2s）点击一步，中间持续瞄准

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 每个策略返回 { hover: [r,c]|null, press: [r,c]|null }
function greedy(run, state) {
  if (run.phase !== 'playing') return { hover: null, press: null };
  const aim = state.solIdx < run.solution.length ? run.solution[state.solIdx] : [0, 0];
  state.timer = (state.timer ?? 0) + 1;
  if (state.timer >= PRESS_EVERY && state.solIdx < run.solution.length) {
    state.timer = 0;
    const press = aim;
    state.solIdx += 1;
    return { hover: aim, press };
  }
  return { hover: aim, press: null };
}

function randomInput(run, state, rng) {
  if (run.phase !== 'playing') return { hover: null, press: null };
  // 连续微调：每 20 tick 换一个瞄准格（真实操作模型），偶尔震颤到邻格
  state.timer = (state.timer ?? 0) + 1;
  if (state.timer % 20 === 0) {
    const r = Math.floor(rng() * run.N);
    const c = Math.floor(rng() * run.N);
    state.aim = [r, c];
  }
  const aim = state.aim || [0, 0];
  if (state.timer >= PRESS_EVERY) {
    state.timer = 0;
    return { hover: aim, press: [Math.floor(rng() * run.N), Math.floor(rng() * run.N)] };
  }
  return { hover: aim, press: null };
}

function noinput() { return { hover: null, press: null }; }

function play(name, policyFn, seed) {
  const run = createRun({ level: 0, seed });
  const rng = mulberry32(seed);
  const maxTicks = Math.round(MAX_SEC / STEP);
  const st = { solIdx: 0, timer: 0, aim: null };

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    totalTicks += 1;
    const decision = policyFn(run, st, rng) || {};
    const didInput = decision.hover != null;

    if (decision.press) {
      run.press(decision.press[0], decision.press[1]);
      actions += 1;
      if (firstInputSec < 0) firstInputSec = run.time;
    } else {
      run.step({});
    }

    const sec = run.time;
    const tickEvents = run.drainEvents();
    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'solved' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }

    const idle = !didInput && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    if (run.phase === 'solved') {
      st.solIdx = 0;
      st.timer = 0;
      run.nextLevel();
      if (run.phase === 'complete') break;
    }
    if (name === 'greedy' && run.stats.levelsSolved >= 3 && run.phase === 'playing') break;
    if (run.phase === 'dead') break;
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
    levelsReached: run.stats.levelsReached,
    completed: run.phase !== 'dead',
    solved: run.stats.levelsSolved,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

const strategies = [
  { name: 'greedy', fn: greedy, seed: 123 },
  { name: 'random', fn: randomInput, seed: 456 },
  { name: 'noinput', fn: noinput, seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.fn, s.seed));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ game: 'light-grid', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log('strategies:', records.map((r) => `${r.policy}(levels=${r.levelsReached},solved=${r.solved},dead=${r.deaths},dur=${r.durationSec}s,events=${r.uniqueEvents},idle=${Math.round((r.idleSec / r.durationSec) * 100)}%)`).join('  '));
console.log('autoplay.json records:', records.length);
