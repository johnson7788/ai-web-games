// STARWAR DEFENSE · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。跑 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

function acc() {
  return {
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    deepest: 0,
  };
}

function drain(run, a) {
  for (const e of run.drainEvents()) {
    a.seen.add(e.type);
    a.eventTimes.push(a.simTime);
    if (e.type === 'win' && a.firstSuccessAt === null) a.firstSuccessAt = a.simTime;
    if (e.type === 'lose') a.deaths += 1;
  }
}

function act(run, a, fn) {
  const r = fn();
  if (r && r.ok) {
    a.actions += 1;
    if (a.firstInputAt === null) a.firstInputAt = a.simTime;
  }
  return r;
}

function finish(run, a, policy, seed, completed) {
  const times = a.eventTimes.slice().sort((x, y) => x - y);
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
    level: a.deepest,
    durationSec: Number(a.simTime.toFixed(2)),
    firstInputSec: Number((a.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: a.firstSuccessAt === null ? null : Number(a.firstSuccessAt.toFixed(2)),
    deaths: a.deaths,
    actions: a.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: a.seen.size,
    levelsReached: a.deepest,
    completed,
  };
}

// greedy：主炮连发 + 能量满就大招，串行打 1→2→3（推进率门槛要求到达第 3 波）
function greedy(seed) {
  const a = acc();
  let completed = false;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: (seed + lv * 7) >>> 0 });
    a.deepest = lv + 1;
    const MAX_STEPS = 20000;
    let won = false;
    for (let s = 0; s < MAX_STEPS; s += 1) {
      if (run.state.phase !== 'playing') { won = run.state.phase === 'won'; break; }
      act(run, a, () => run.fire());
      act(run, a, () => run.blast());
      run.step(DT);
      a.simTime += DT;
      drain(run, a);
    }
    completed = won;
    if (!won) break;
  }
  return finish(null, a, 'greedy', seed, completed);
}

// random：乱点（短促开火 + 长停顿的「手忙脚乱」玩家），验证输入鲁棒与失败路径
function random(seed) {
  const run = createRun(0, { seed });
  const a = acc();
  a.deepest = 1;
  const MAX_SEC = 90;
  let completed = false;
  let fireUntil = 0;
  let idleUntil = 0;
  while (run.state.phase === 'playing' && a.simTime < MAX_SEC) {
    // 每次「决定」：短促开火 0.15~0.4s，然后停 2.5~4.5s（手忙脚乱的玩家）
    if (a.simTime >= idleUntil) {
      fireUntil = a.simTime + 0.15 + Math.random() * 0.25;
      idleUntil = fireUntil + 2.5 + Math.random() * 2.0;
    }
    if (a.simTime < fireUntil) act(run, a, () => run.fire());
    if (Math.random() < 0.04) act(run, a, () => run.blast());
    run.step(DT);
    a.simTime += DT;
    drain(run, a);
  }
  completed = run.state.phase === 'won';
  return finish(run, a, 'random', seed, completed);
}

// noinput：只推进时间，测自动推进/死时间基线（无输入 → 主炮不开火 → 必然漏穿）
function noinput(seed) {
  const run = createRun(0, { seed });
  const a = acc();
  a.deepest = 1;
  const MAX_SEC = 60;
  let completed = false;
  while (run.state.phase === 'playing' && a.simTime < MAX_SEC) {
    run.step(DT);
    a.simTime += DT;
    drain(run, a);
  }
  completed = run.state.phase === 'won';
  return finish(run, a, 'noinput', seed, completed);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'starwar-defense',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
