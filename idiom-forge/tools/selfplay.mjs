// IDIOM FORGE · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
// 输入模型：greedy/random 用连续光标微调 + 震颤（真实桌面指针），点击候选字格。
// 空转 = 该 tick 既无输入动作也无任何事件（连击反馈/倒计时脉冲不算空转）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300;
const INPUT_LATENCY_MS = 90;

// ---------- 策略 ----------
function makeGreedy(botRng) {
  const st = { key: '', target: -1, aim: 3, decidedAt: -1, prevHover: 3 };
  return (run, tick) => {
    const hud = run.getHud();
    const q = hud.question;
    const key = q.key + ':' + hud.currentBlank;
    if (st.key !== key) {
      st.key = key;
      const want = q.answer[q.blanks[hud.currentBlank]];
      st.target = hud.grid.indexOf(want);
      st.decidedAt = tick;
    }
    const t = st.target < 0 ? st.aim : st.target;
    const diff = t - st.aim;
    const toward = Math.max(-0.4, Math.min(0.4, diff));
    const tremor = (botRng() - 0.5) * 0.3;
    st.aim += Math.abs(diff) > 0.5 ? toward : tremor;
    const maxIdx = Math.max(0, hud.grid.length - 1);
    st.aim = Math.max(0, Math.min(maxIdx, st.aim));
    let pick = null;
    const arrived = Math.abs(st.aim - st.target) < 0.6;
    if (st.target >= 0 && arrived && tick - st.decidedAt >= 24) {
      pick = st.target;
      st.decidedAt = tick;
    }
    const hoverMoved = Math.abs(st.aim - st.prevHover) > 0.01;
    st.prevHover = st.aim;
    return { pick, hoverMoved };
  };
}

function makeRandom(botRng) {
  const st = { aim: 3, prevHover: 3, nextPick: 20 };
  return (run, tick) => {
    const hud = run.getHud();
    const maxIdx = Math.max(0, hud.grid.length - 1);
    if (tick % 20 === 0) st.aim = botRng() * maxIdx;
    const tremor = (botRng() - 0.5) * 0.5;
    st.aim = Math.max(0, Math.min(maxIdx, st.aim + tremor));
    let pick = null;
    if (tick >= st.nextPick) {
      pick = Math.floor(botRng() * hud.grid.length);
      st.nextPick = tick + 18 + Math.floor(botRng() * 24);
    }
    const hoverMoved = Math.abs(st.aim - st.prevHover) > 0.01;
    st.prevHover = st.aim;
    return { pick, hoverMoved };
  };
}

function noinput() {
  return { pick: null, hoverMoved: false };
}

// ---------- 跑一局 ----------
function play(name, inputFor, seed) {
  const run = createRun({ seed, lang: 'en' });
  const maxTicks = Math.round(MAX_SEC / STEP);

  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let actions = 0;
  let idleTicks = 0;
  let totalTicks = 0;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step(input.pick != null ? { pick: input.pick } : {});
    const sec = run.time;

    const acted = input.pick != null || input.hoverMoved === true;
    if (firstInputSec < 0 && acted) firstInputSec = sec;
    if (acted) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !acted && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'solve' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }
  }

  const durationSec = run.time;
  const levelReached = run.getLevel();
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
    levelsReached: levelReached,
    completed: run.phase !== 'dead',
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
    maxCombo: run.getStats().maxCombo,
    weaponsForged: run.getStats().weaponsForged,
  };
}

function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'idiom-forge', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  return records;
}

const strategies = [
  { name: 'greedy', inputFor: makeGreedy(mulberry32(123)), seed: 123 },
  { name: 'random', inputFor: makeRandom(mulberry32(456)), seed: 456 },
  { name: 'noinput', inputFor: () => noinput(), seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.inputFor, s.seed));
const all = writeRuns(records);
console.log('strategies:', records.map((r) => `${r.policy}(level=${r.levelsReached},won=${r.completed},dead=${r.deaths},dur=${r.durationSec}s,act/min=${r.actionsPerMin},idle=${r.idleSec}s,uniq=${r.uniqueEvents})`).join('  '));
console.log('autoplay.json records:', all.length);
