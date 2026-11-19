// MERGE BASKETBALL · 自对弈（Node 无头，直接 import sim）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：瞄准同数值球强制合成，快速冲 1024；random：乱丢验证鲁棒与死亡；
// noinput：只推进时间，靠 auto-drop 兜底最终判负（保证 deathPresence）。
import { createRun, mulberry32, rankFor } from '../src/game/sim.js';
import { WORLD, GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const WIDTH = WORLD.WIDTH;

function makeTracker(run, policy, seed) {
  const seen = new Set();
  const eventTimes = [0];
  let simTime = 0;
  let firstInputAt = null;
  let firstAutoAt = null;
  let firstSuccessAt = null;
  let deaths = 0;
  let actions = 0;
  return {
    get simTime() { return simTime; },
    tick(dt) {
      run.step(dt);
      simTime += dt;
      for (const e of run.drainEvents()) {
        seen.add(e.type);
        eventTimes.push(simTime);
        if ((e.type === 'merge' || e.type === 'win') && firstSuccessAt === null) firstSuccessAt = simTime;
        if (e.type === 'autoDrop' && firstAutoAt === null) firstAutoAt = simTime;
        if (e.type === 'lose') deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        actions += 1;
        if (firstInputAt === null) firstInputAt = simTime;
      }
      return res;
    },
    finish() {
      const times = eventTimes.slice().sort((a, b) => a - b);
      let maxGap = 0;
      let idleSec = 0;
      for (let i = 1; i < times.length; i += 1) {
        const gap = times[i] - times[i - 1];
        if (gap > maxGap) maxGap = gap;
        if (gap > 3) idleSec += gap - 3;
      }
      return {
        id: `${policy}-1`,
        policy,
        seed,
        durationSec: Number(simTime.toFixed(2)),
        firstInputSec: Number(((firstInputAt ?? firstAutoAt ?? 0)).toFixed(2)),
        inputLatencyMs: 0,
        firstSuccessSec: firstSuccessAt === null ? null : Number(firstSuccessAt.toFixed(2)),
        deaths,
        actions,
        idleSec: Number(idleSec.toFixed(2)),
        maxEventGapSec: Number(maxGap.toFixed(2)),
        uniqueEvents: seen.size,
        levelsReached: rankFor(run.state.biggest),
        completed: run.state.won === true,
      };
    },
  };
}

// 判断球是否暴露（上方没有其它球压着，落球能直接命中）
function isExposed(run, b, dropR) {
  for (const o of run.state.balls) {
    if (o === b || o.dead) continue;
    const dx = Math.abs(o.x - b.x);
    if (dx < (o.r + dropR) * 0.55 && o.y < b.y - (b.r + o.r) * 0.4) return false;
  }
  return true;
}

// 找一个同数值、mergeLock 结束、且暴露在表面的球，作为瞄准目标（取最深的）
function findSameValueTarget(run) {
  const v = run.state.nextValue;
  const dropR = v > 0 ? (Math.log2(v) - 1) * 6 + 15 : 15;
  let best = null;
  for (const b of run.state.balls) {
    if (b.dead || b.kind !== 'ball' || b.value !== v || b.mergeLock > 0) continue;
    if (!isExposed(run, b, dropR)) continue;
    if (!best || b.y > best.y) best = b;
  }
  return best;
}

// 无目标时：找最低的列（堆顶最深），保持左右均衡
function bestSpreadX(run) {
  const COLS = 7;
  const w = WIDTH / COLS;
  const count = new Array(COLS).fill(0);
  const topY = new Array(COLS).fill(WORLD.HEIGHT);
  for (const b of run.state.balls) {
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(b.x / w)));
    count[c] += 1;
    topY[c] = Math.min(topY[c], b.y - b.r);
  }
  let best = 0;
  for (let c = 1; c < COLS; c += 1) {
    if (count[c] < count[best] || (count[c] === count[best] && topY[c] > topY[best])) best = c;
  }
  return (best + 0.5) * w;
}

function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SIM = 1200;
  const rng = mulberry32(seed * 31 + 7);
  let guard = Math.ceil(MAX_SIM * 60);
  while (run.state.phase !== 'lost' && !run.state.won && tel.simTime < MAX_SIM && guard-- > 0) {
    if (run.canDrop()) {
      const tgt = findSameValueTarget(run);
      const x = tgt ? tgt.x : bestSpreadX(run) + (rng() * 10 - 5);
      tel.act(() => run.drop(Math.max(16, Math.min(WIDTH - 16, x))));
    }
    tel.tick(1 / 60);
  }
  // 已触发 win 但可能还有球在途：跑一小段让状态稳定
  while (run.state.phase !== 'lost' && guard-- > 0 && tel.simTime < MAX_SIM) tel.tick(1 / 60);
  return tel.finish();
}

function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SIM = 180;
  while (run.state.phase !== 'lost' && !run.state.won && tel.simTime < MAX_SIM) {
    if (run.canDrop() && rng() < 0.65) {
      tel.act(() => run.drop(16 + rng() * (WIDTH - 32)));
    }
    tel.tick(1 / 60);
  }
  return tel.finish();
}

function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SIM = 240;
  while (run.state.phase !== 'lost' && !run.state.won && tel.simTime < MAX_SIM) {
    tel.tick(1 / 60);
  }
  return tel.finish();
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'merge-basketball',
  genre: 'puzzle',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
