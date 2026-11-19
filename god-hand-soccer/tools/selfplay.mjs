// GOD HAND SOCCER · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 写 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy 串行打 L1→L2→L3，满足推进率门槛；random 乱按验证输入鲁棒；noinput 测死时间基线。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function laneFromX(x) {
  if (x < 320) return 0;
  if (x < 640) return 1;
  if (x < 960) return 2;
  return 3;
}

function makeTracker(policy, seed, levelNum, carried) {
  return {
    policy,
    seed,
    level: levelNum,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    tick(run) {
      run.step();
      this.simTime += 1 / 60;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(run, action) {
      const res = run.input(action);
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return res;
    },
  };
}

function finish(tel, run, completed) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: `${tel.policy}-1`,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed,
    _tel: tel,
  };
}

// 贪婪决策：每半场找最近的逼近障碍，挡着当前车道就切到另一条。
function greedyDecide(run) {
  const st = run.state;
  if (st.phase !== 'playing') return [];
  const bottom = WORLD.STRIKER_Y + WORLD.STRIKER_R;
  const actions = [];
  for (const half of ['L', 'R']) {
    const strikerLane = half === 'L' ? (st.leftInner ? 1 : 0) : (st.rightInner ? 2 : 3);
    // 只盯最近的一条障碍（y 最大 = 离前锋最近）：挡着当前车道才切。
    let nearest = null;
    for (const w of st.walls) {
      if (w.half !== half || w.passed) continue;
      if (w.y - w.h / 2 > bottom) continue; // 已在前锋下方（已过）
      if (!nearest || w.y > nearest.y) nearest = w;
    }
    if (!nearest) continue;
    const lane = nearest.kind === 'rock' ? laneFromX(nearest.x) : nearest.lane;
    if (lane === strikerLane) actions.push(half === 'L' ? 'left' : 'right');
  }
  return actions;
}

function greedyOnce(levelIndex, seed, carried, levelNum) {
  const run = createRun(levelIndex, { seed });
  run.start();
  const tel = makeTracker('greedy', seed, levelNum, carried);
  // 立即动作一次，确保 firstInput 尽早注册
  tel.act(run, 'left');
  const MAX_STEPS = 60 * 220; // 上限 220s，远超三关累计
  let completed = false;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'playing') break;
    for (const a of greedyDecide(run)) tel.act(run, a);
    tel.tick(run);
  }
  completed = run.state.phase === 'won';
  return finish(tel, run, completed);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv * 7, carried, lv + 1);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  run.start();
  const tel = makeTracker('random', seed, 1, null);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (rng() < 0.14) tel.act(run, 'left');
    if (rng() < 0.14) tel.act(run, 'right');
    tel.tick(run);
  }
  return finish(tel, run, run.state.phase === 'won');
}

function noinput(seed) {
  const run = createRun(0, { seed });
  run.start();
  const tel = makeTracker('noinput', seed, 1, null);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(run);
  return finish(tel, run, run.state.phase === 'won');
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'god-hand-soccer',
  genre: 'arcade',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents} maxGap=${r.maxEventGapSec}s idle=${r.idleSec}s`,
  );
}
