// BRICK BLITZ · 自对弈：Node 无头，直接 import sim（无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: carried ? carried.simTime : 0,
    firstInputAt: carried ? carried.firstInputAt : null,
    firstSuccessAt: carried ? carried.firstSuccessAt : null,
    deaths: carried ? carried.deaths : 0,
    actions: carried ? carried.actions : 0,
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
  };
  tel.level = run.state.level;
  tel.tick = (dt) => {
    run.step(dt);
    tel.simTime += dt;
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lifeLost') tel.deaths += 1;
    }
  };
  tel.act = (fn) => {
    const res = fn();
    if (res && res.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    tel.tick(1 / 60);
    return res;
  };
  return tel;
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    out: {
      id: tel.id,
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
      completed: run.state.phase === 'won',
    },
    tel,
  };
}

// greedy：跟踪陶珠，球上升时把挡板对准最近的存活砖，下落时回正接球。
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_STEPS = 4800; // 80s @60Hz
  for (let step = 0; step < MAX_STEPS && run.state.phase === 'playing'; step += 1) {
    const s = run.state;
    const ball = s.balls.find((b) => !b.dead) || s.balls[0];
    if (ball && ball.stuck) {
      tel.act(() => run.launch());
      continue;
    }
    let target;
    if (ball) {
      // 偏移扫掠：挡板略偏球正下方，把陶珠以不同角度打向各列，横扫清场
      const bias = Math.sin(step * 0.028) * 44;
      target = ball.x + bias;
    } else {
      target = s.paddle.x + s.paddle.w / 2;
    }
    tel.act(() => run.setPaddleTarget(target - s.paddle.w / 2));
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const r = greedyOnce(lv, seed + lv, carried);
    last = r.out;
    carried = r.tel;
    if (!r.out.completed) break;
  }
  return last;
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 45;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const s = run.state;
    if (s.balls.some((b) => b.stuck)) {
      tel.act(() => run.launch());
      continue;
    }
    const target = rng() * 1280;
    tel.act(() => run.setPaddleTarget(target));
  }
  return finish(tel, run).out;
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 40;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run).out;
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'brick-blitz',
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
    `actions=${r.actions} deaths=${r.deaths} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
