// METEOR SMASHER · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。固定 seed 驱动 greedy / random / noinput 三策略，
// 每跑完一局写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTel(id, policy, seed) {
  return {
    id, policy, seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
  };
}

function tick(run, tel) {
  run.step(1 / 60);
  tel.simTime += 1 / 60;
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if ((e.type === 'killMeteor' || e.type === 'core' || e.type === 'thruster' || e.type === 'pad') && tel.firstSuccessAt === null) {
      tel.firstSuccessAt = tel.simTime;
    }
    if (e.type === 'gameOver') tel.deaths += 1;
  }
}

function act(run, tel) {
  const res = run.slam();
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
  }
  tick(run, tel);
  return !!(res && res.ok);
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
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'over',
  };
}

// greedy：预测现在砸击能否命中收益实体（非尖刺），能就砸；否则推进。
function greedy(seed, maxSec) {
  const run = createRun({ seed });
  const tel = makeTel('greedy-1', 'greedy', seed);
  const maxFrames = Math.ceil(maxSec * 60);
  for (let f = 0; f < maxFrames; f += 1) {
    if (run.state.phase !== 'running') break;
    if (run.state.player.value <= 1) {
      const t = run.predictSlamTarget();
      if (t && t.kind !== 'spike') {
        act(run, tel);
        continue;
      }
    }
    tick(run, tel);
  }
  return finish(tel, run);
}

// random：每帧 30% 概率砸击，验证输入鲁棒。
function random(seed, maxSec) {
  const run = createRun({ seed });
  const tel = makeTel('random-1', 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const maxFrames = Math.ceil(maxSec * 60);
  for (let f = 0; f < maxFrames; f += 1) {
    if (run.state.phase !== 'running') break;
    if (rng() < 0.3) act(run, tel);
    else tick(run, tel);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死时间基线。
function noinput(seed, maxSec) {
  const run = createRun({ seed });
  const tel = makeTel('noinput-1', 'noinput', seed);
  const maxFrames = Math.ceil(maxSec * 60);
  for (let f = 0; f < maxFrames; f += 1) {
    if (run.state.phase !== 'running') break;
    tick(run, tel);
  }
  return finish(tel, run);
}

const runs = [
  greedy(3, 45),
  random(2, 30),
  noinput(3, 30),
];
const payload = {
  game: 'meteor-smasher',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
