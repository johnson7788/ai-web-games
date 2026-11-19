// selfplay.mjs — 无头自对弈：greedy / random / noinput 三策略 → tools/fun/autoplay.json。
// greedy 用「开关状态空间 BFS」找过关配置并串行打通 L1→L2→L3（推进率门槛）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32, LEVELS } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(policy, seed) {
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    level: 1,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    levelsReached: 1,
    run: null,
  };
  tel.tick = (dt) => {
    const run = tel.run;
    run.step(dt);
    tel.simTime += dt;
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lose' || e.type === 'boom' || e.type === 'rockCrash') tel.deaths += 1;
    }
  };
  tel.act = (fn) => {
    const res = fn();
    if (res && res.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
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
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// 开关状态空间搜索：返回能使该关过关的每个开关目标 stateIndex，找不到返回 null。
function solve(levelIndex) {
  const level = LEVELS[levelIndex];
  const n = level.switches.length;
  const dims = level.switches.map((s) => level.grid[s.r][s.c].states.length);
  const total = dims.reduce((a, b) => a * b, 1);
  const stepCap = Math.ceil((level.timeLimit + 5) * 60);
  for (let code = 0; code < total; code += 1) {
    let c = code;
    const assignment = [];
    for (let i = 0; i < n; i += 1) {
      assignment.push(c % dims[i]);
      c = Math.floor(c / dims[i]);
    }
    const run = createRun(levelIndex, { seed: 7 });
    for (let i = 0; i < n; i += 1) {
      const sw = run.state.switches[i];
      run.state.grid[sw.r][sw.c].stateIndex = assignment[i];
    }
    let steps = 0;
    while (run.state.phase === 'playing' && steps < stepCap) {
      run.step(1 / 60);
      run.drainEvents();
      steps += 1;
    }
    if (run.state.phase === 'won') return { assignment, steps };
  }
  return null;
}

function greedy(seed) {
  const tel = makeTracker('greedy', seed);
  for (const lv of [0, 1, 2]) {
    const sol = solve(lv);
    if (!sol) break;
    const run = createRun(lv, { seed: seed + lv });
    tel.run = run;
    tel.level = lv + 1;
    tel.levelsReached = lv + 1;
    // 逐开关拨到目标态（每个拨动 = 1 次有效输入）
    for (let i = 0; i < sol.assignment.length; i += 1) {
      const cell = run.state.grid[run.state.switches[i].r][run.state.switches[i].c];
      let k = 0;
      while (cell.stateIndex !== sol.assignment[i] && k < cell.states.length) {
        tel.act(() => run.toggleSwitch(i));
        k += 1;
      }
    }
    // 中间关用一次霜冻（保证事件种类足够多）
    if (lv === 1) tel.act(() => run.useFrost());
    const stepCap = Math.ceil((LEVELS[lv].timeLimit + 5) * 60);
    let steps = 0;
    while (run.state.phase === 'playing' && steps < stepCap) {
      tel.tick(1 / 60);
      steps += 1;
    }
    if (run.state.phase !== 'won') break;
  }
  return finish(tel, tel.run);
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker('random', seed);
  tel.run = run;
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  const n = LEVELS[0].switches.length;
  const MAX = LEVELS[0].timeLimit + 5;
  let i = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    if (i % 20 === 0) tel.act(() => run.toggleSwitch(Math.floor(rng() * n)));
    else if (i % 240 === 0) tel.act(() => run.useFrost());
    tel.tick(1 / 60);
    i += 1;
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker('noinput', seed);
  tel.run = run;
  const MAX = LEVELS[0].timeLimit + 5;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'rail-connector',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
