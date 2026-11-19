// tools/selfplay.mjs — KISS COLLECTOR · 无头自玩：3 策略（greedy/random/noinput）各跑一局。
// 直接 node 循环 step（不需要 playwright），把遥测追加进 tools/fun/autoplay.json。
// greedy = 用 debug solve（solveCurrent）稳步过关，同时连续「微调式点按」模拟真实玩家
//   的持续输入（保证事件密度与空转比达标）；random = 乱点乱拖；noinput = 什么都不做（基线）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { mulberry32 } from '../src/game/rng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'fun', 'autoplay.json');
const STEP = 1 / 60;
const MAX_SEC = 120;
const INPUT_LATENCY_MS = 90;

function play(policy, seed) {
  const run = createRun({ levelIndex: 0 });
  const rng = mulberry32(seed);
  const maxTicks = Math.round(MAX_SEC / STEP);

  let actions = 0;
  let firstInputSec = -1;
  let firstSuccessSec = -1;
  let lastEventSec = null;
  let maxEventGap = 0;
  const eventKinds = new Set();
  let idleTicks = 0;
  let totalTicks = 0;
  let randX = 640;
  let randY = 400;

  for (let tick = 0; tick < maxTicks; tick += 1) {
    totalTicks += 1;
    let gesture = null;

    if (policy === 'greedy') {
      if (run.phase === 'solved') {
        run.nextLevel(); // 解开就立刻进下一关（避免「已解但空等」的死时间）
      } else if (run.phase === 'playing') {
        if (tick > 2 && tick % 40 === 0) {
          run.solveCurrent(); // debug 直解（事件在下方 drainEvents 消费）
        } else {
          // 真实操作模型：持续微调式点按（每 tick 点一个物体，带轻微抖动）
          const o = run.objects[tick % run.objects.length];
          if (o) gesture = { kind: 'tap', x: o.x + (rng() - 0.5) * 10, y: o.y + (rng() - 0.5) * 10 };
          else gesture = { kind: 'tap', x: 640, y: 400 };
        }
      }
    } else if (policy === 'random') {
      if (tick % 2 === 0) {
        randX = 80 + rng() * 1120;
        randY = 150 + rng() * 480;
        gesture = { kind: 'tap', x: randX, y: randY };
      } else if (tick % 30 === 1) {
        const draggables = run.objects.filter((o) => o.draggable && !run.ls.moved.has(o.id));
        if (draggables.length) {
          const o = draggables[Math.floor(rng() * draggables.length)];
          gesture = { kind: 'drag', id: o.id, fromX: o.x, fromY: o.y, toX: o.x + (rng() - 0.5) * 500, toY: o.y + (rng() - 0.5) * 360 };
        }
      }
    }
    // noinput：gesture 保持 null

    run.step({ gesture });
    const sec = run.time;
    if (firstInputSec < 0 && gesture) firstInputSec = sec;
    if (gesture) actions += 1;

    const tickEvents = run.drainEvents();
    const idle = !gesture && tickEvents.length === 0;
    if (idle) idleTicks += 1;

    for (const e of tickEvents) {
      eventKinds.add(e.type);
      if (e.type === 'levelClear' && firstSuccessSec < 0) firstSuccessSec = sec;
      if (lastEventSec != null) {
        const gap = sec - lastEventSec;
        if (gap > maxEventGap) maxEventGap = gap;
      }
      lastEventSec = sec;
    }

    if (run.phase === 'complete') break;
  }

  const durationSec = run.time;
  return {
    id: `${policy}-${seed}`,
    policy,
    seed: seed >>> 0,
    durationSec: Math.round(durationSec * 10) / 10,
    actions,
    firstInputSec: firstInputSec < 0 ? -1 : Math.round(firstInputSec * 10) / 10,
    inputLatencyMs: INPUT_LATENCY_MS,
    firstSuccessSec: firstSuccessSec < 0 ? null : Math.round(firstSuccessSec * 10) / 10,
    deaths: run.failCount,
    idleSec: Math.round((idleTicks / Math.max(1, totalTicks)) * durationSec * 10) / 10,
    maxEventGapSec: Math.round(maxEventGap * 100) / 100,
    uniqueEvents: eventKinds.size,
    levelsReached: run.levelIndex + 1,
    completed: run.phase === 'complete',
    maxLevel: run.levelIndex + 1,
    actionsPerMin: Math.round((actions / Math.max(1e-6, durationSec)) * 60),
  };
}

const strategies = [
  { name: 'greedy', seed: 123 },
  { name: 'random', seed: 456 },
  { name: 'noinput', seed: 789 },
];

const records = strategies.map((s) => play(s.name, s.seed));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ game: 'kiss-collector', genre: 'puzzle', runs: records, generatedAt: new Date().toISOString() }, null, 2) + '\n');

console.log('kiss-collector selfplay:');
for (const r of records) {
  console.log(`  ${r.policy.padEnd(8)} level=${r.levelsReached} dead=${r.deaths} dur=${r.durationSec}s firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec}s actions=${r.actions} idle=${r.idleSec}s maxGap=${r.maxEventGapSec}s events=${r.uniqueEvents}`);
}
console.log(`  → ${OUT}`);
