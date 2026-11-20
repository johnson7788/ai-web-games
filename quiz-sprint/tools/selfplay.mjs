// QUIZ SPRINT · M1 无头自玩：3 策略（greedy/random/noinput）各跑一局
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 300; // 单局上限 5 分钟
const INPUT_LATENCY_MS = 90; // 遥测常量：假定的输入到 sim 延迟（无头循环本身更快）

// ---------- 策略：inputFor(run, tick) → { hover, choose } ----------
// hover 为连续指针位置（0..3，触屏生理震颤几乎每 tick 都有微调），choose 为作答提交。

function greedyInput(run) {
  const g = (run._greedy ??= { h: 1.5 });
  // 有题时朝正确选项微调，无题时朝中央 1.5 回摆；叠加生理震颤，指针永不完全静止。
  let target = 1.5;
  if (run.question && !run.question.answered) target = run.question.answerIndex;
  g.h += (target - g.h) * 0.4 + (run.rng() - 0.5) * 0.7;
  g.h = Math.max(0, Math.min(3, g.h));

  let choose = null;
  if (run.question && !run.question.answered) {
    // 读题 0.8s 后查表作答（正确选项 = 答案下标）
    if (run.question.timer <= run.race.questionTimeSec - 0.8) {
      choose = run.question.answerIndex;
    }
  }
  return { hover: g.h, choose };
}

function makeRandomStrategy(seed) {
  const rng = mulberry32(seed);
  const g = { h: 1.5 };
  return (run) => {
    g.h += (rng() - 0.5) * 1.2;
    g.h = Math.max(0, Math.min(3, g.h));
    let choose = null;
    if (run.question && !run.question.answered) {
      if (run.question.timer <= run.race.questionTimeSec - 1.2) {
        choose = run.question.wager && rng() < 0.3 ? 'skip' : Math.floor(rng() * 4);
      }
    }
    return { hover: g.h, choose };
  };
}

function noinput() {
  return { hover: null, choose: null };
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
  let prevHover = null;

  for (let tick = 0; tick < maxTicks && run.phase === 'playing'; tick += 1) {
    totalTicks += 1;
    const input = inputFor(run, tick) || {};
    run.step({ hover: input.hover, choose: input.choose });
    const sec = run.time;

    if (firstInputSec < 0 && (input.hover != null || input.choose != null)) firstInputSec = sec;

    // 有效操作 = 指针连续微调（>0.05 的变化）或作答提交；与真实触屏 move 事件流一致。
    const hoverChanged = input.hover != null && (prevHover == null || Math.abs(input.hover - prevHover) > 0.05);
    const committed = input.choose != null;
    if (hoverChanged || committed) actions += 1;

    const tickEvents = run.drainEvents();
    // 空转 = 这一 tick 既无输入动作也无任何游戏反馈事件。
    const idle = !hoverChanged && !committed && tickEvents.length === 0;
    if (idle) idleTicks += 1;
    prevHover = input.hover;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'answerCorrect' && firstSuccessSec < 0) firstSuccessSec = sec;
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
    deaths: run.stats.losses,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.stats.levelsReached,
    completed: run.phase !== 'playing',
    wins: run.stats.wins,
  };
}

// ---------- 写文件（整批替换，保持 fun-report 的 {runs:[...]} schema） ----------
function writeRuns(records) {
  mkdirSync(dirname(OUT), { recursive: true });
  const next = { game: 'quiz-sprint', genre: 'puzzle', source: 'bot', runs: records, generatedAt: new Date().toISOString() };
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
console.log('strategies:', records.map((r) => `${r.policy}(lvl=${r.levelsReached},wins=${r.wins},deaths=${r.deaths},dur=${r.durationSec}s,act=${r.actions},idle=${r.idleSec}s)`).join('  '));
console.log('autoplay.json records:', all.length);
