// LADDER CLIMBER · 自对弈：Node 无头直接驱动 sim（无 DOM）。
// greedy / random / noinput 三策略 → tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function stageOf(index) {
  return Math.floor(index / GAME.STAGE_FLOORS) + 1;
}

function makeTracker(run, policy, seed) {
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
  };
  tel.consume = () => {
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'climb' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lose') tel.deaths += 1;
    }
  };
  tel.tick = (dt) => {
    run.step(dt);
    tel.simTime += dt;
    tel.consume();
  };
  tel.act = (fn) => {
    const res = fn();
    if (res && res.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
      tel.consume();
    }
    return res;
  };
  return tel;
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
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: stageOf(run.state.curIndex),
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: stageOf(run.state.curIndex),
    completed,
  };
}

// greedy：永远爬对方向，爬满 60 层即达成（模拟可通关/内容可达）
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const TARGET = 60;
  let guard = 0;
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && guard++ < 20000) {
    if (run.state.curIndex >= TARGET) break;
    for (let f = 0; f < 9 && (run.state.phase === 'ready' || run.state.phase === 'playing'); f += 1) tel.tick(1 / 60);
    if (run.state.phase === 'end') break;
    const res = tel.act(() => run.climbCorrect());
    if (res.dead) break;
  }
  return finish(tel, run, run.state.curIndex >= TARGET);
}

// random：随机左右，验证输入鲁棒与失败存在
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && guard++ < 20000 && tel.simTime < 90) {
    const wait = Math.floor(rng() * 20) + 1;
    for (let f = 0; f < wait && (run.state.phase === 'ready' || run.state.phase === 'playing'); f += 1) tel.tick(1 / 60);
    if (run.state.phase === 'end') break;
    const dir = rng() < 0.5 ? -1 : 1;
    const res = tel.act(() => run.climb(dir));
    if (res.dead) break;
  }
  return finish(tel, run, false);
}

// noinput：只推进时间（3 秒后自动启动塌陷，脚下楼层被吞 → 死亡基线）
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && guard++ < 20000) {
    tel.tick(1 / 60);
  }
  return finish(tel, run, false);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'ladder-climber',
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
    `actions=${r.actions} deaths=${r.deaths} stage=${r.levelsReached} completed=${r.completed}`,
  );
}
