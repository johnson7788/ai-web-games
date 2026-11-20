// PHANTOM RUN · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用 greedy / random / noinput 三策略驱动，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy：完美跳跃（跳间隙/尖刺）+ 安全地面 bunny-hop；串行打 L1→L2→L3。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { shouldJump, nextTrigger } from '../src/game/level.js';
import { PLAYER } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;

function makeTracker(run, policy, seed, carried) {
  const tel = {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    hopT: 0,
  };
  tel.step = (input) => {
    run.step(input);
    tel.simTime += STEP;
    for (const e of run.drainEvents()) {
      tel.seen.add(e.type);
      tel.eventTimes.push(tel.simTime);
      if (e.type === 'jump') {
        tel.actions += 1;
        if (tel.firstInputAt == null) tel.firstInputAt = tel.simTime;
      }
      if (e.type === 'win' && tel.firstSuccessAt == null) tel.firstSuccessAt = tel.simTime;
      if (e.type === 'lose') tel.deaths += 1;
    }
  };
  return tel;
}

function finish(tel, run, levelReached) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  const out = {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: levelReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: levelReached,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// greedy：完美跳跃 + 安全 bunny-hop
function greedyDecide(run, tel) {
  const p = run.state.player;
  if (!p.onGround) return false;
  const trigger = nextTrigger(run.state);
  if (trigger != null && p.x + PLAYER.W >= trigger - 12) return true;
  if ((trigger == null || trigger > p.x + 250) && tel.simTime - tel.hopT >= 0.7) {
    tel.hopT = tel.simTime;
    return true;
  }
  return false;
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  let guard = 40000;
  while (run.state.phase === 'running' && guard-- > 0) {
    tel.step({ jump: greedyDecide(run, tel) });
  }
  return finish(tel, run, run.state.level);
}

// random：随机跳（验证输入鲁棒，且大概率死）
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  let x = seed;
  const rnd = () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
  let guard = 40000;
  while (run.state.phase === 'running' && guard-- > 0) {
    const p = run.state.player;
    tel.step({ jump: p.onGround && rnd() < 0.4 });
  }
  return finish(tel, run, run.state.level);
}

// noinput：什么都不做（自动推进基线，掉坑死）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 40000;
  while (run.state.phase === 'running' && guard-- > 0) {
    tel.step({});
  }
  return finish(tel, run, run.state.level);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2;
  }
  return last;
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'phantom-run',
  genre: 'action',
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
    `actions=${r.actions} apm=${Math.round(r.actions / (r.durationSec / 60))} ` +
    `events=${r.uniqueEvents} deaths=${r.deaths} completed=${r.completed} reached=${r.levelsReached}`,
  );
}
