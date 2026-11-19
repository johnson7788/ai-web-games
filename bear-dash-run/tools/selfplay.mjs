// BEAR DASH RUN · 自对弈（机器玩测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { PLAYER } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function newTracker(policy, seed, level, carry) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level,
    simTime: carry ? carry.simTime : 0,
    firstInputAt: carry ? carry.firstInputAt : null,
    firstSuccessAt: carry ? carry.firstSuccessAt : null,
    deaths: carry ? carry.deaths : 0,
    actions: carry ? carry.actions : 0,
    seen: new Set(carry ? [...carry.seen] : []),
    eventTimes: carry ? [...carry.eventTimes] : [0],
  };
}

function drainInto(tel, run) {
  for (const e of run.drainEvents()) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'win' && tel.firstSuccessAt === null) tel.firstSuccessAt = tel.simTime;
    if (e.type === 'lose') tel.deaths += 1;
  }
}

function finish(tel, run, levelsReached) {
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
    level: levelsReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

// 最近的前方威胁（距离 + 类型）；用于 greedy 决定是否起跳
function nearestThreat(run) {
  const p = run.state.player;
  const pr = p.x + PLAYER.W;
  let best = null;
  const consider = (frontX, kind) => {
    const d = frontX - pr;
    if (best === null || d < best.d) best = { d, kind };
  };
  for (const r of run.entities.rocks) if (r.x + r.w > p.x) consider(r.x, 'rock');
  for (const s of run.entities.spikes) if (s.x + s.w > p.x) consider(s.x, 'spike');
  for (const c of run.entities.chompers) if (c.x + c.w > p.x) consider(c.x, 'chomper');
  for (const e of run.entities.enemies) if (!e.dead && e.x + e.w > p.x) consider(e.x, 'enemy');
  for (const rg of run.entities.rings) if (rg.x + rg.r > p.x - 12) consider(rg.x - rg.r, 'ring');
  return best;
}

// 单跳水平距离约 238px；触发距离按类型校准，保证落地越过该障碍（统一偏早跳，避免落在障碍上）
const TRIGGER = { rock: 60, spike: 60, chomper: 60, ring: 60, enemy: 120 };

function greedyControl(run) {
  const p = run.state.player;
  const inp = { left: false, right: true, jump: false };
  const t = nearestThreat(run);
  if (p.alive && t && p.onGround && t.d < TRIGGER[t.kind]) inp.jump = true;
  return inp;
}

function randomControl(run, rng) {
  const roll = rng();
  const inp = { left: false, right: false, jump: false };
  if (roll < 0.6) inp.right = true;
  else if (roll < 0.75) inp.left = true;
  else if (roll < 0.92) inp.jump = true;
  // 其余 8% 静止
  return inp;
}

function playLevel(levelIndex, policy, seed, tel) {
  const run = createRun(levelIndex, { seed });
  const rng = mulberry32(seed * 7919 + levelIndex * 13 + 5);
  let prevJump = false;
  const MAX_STEPS = 60 * 90; // 90s 上限
  for (let step = 0; step < MAX_STEPS && run.state.phase === 'playing'; step += 1) {
    let inp;
    let acted = false;
    if (policy === 'greedy') {
      inp = greedyControl(run);
      const acceptedJump = inp.jump && !prevJump && run.state.player.jumps < 2 && run.state.player.alive;
      acted = acceptedJump || (step === 0 && inp.right);
      prevJump = inp.jump;
    } else if (policy === 'random') {
      inp = randomControl(run, rng);
      acted = inp.left || inp.right || (inp.jump && run.state.player.jumps < 2);
    } else {
      inp = { left: false, right: false, jump: false };
      acted = false;
    }
    run.input = inp;
    if (acted) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    run.step(1 / 60);
    tel.simTime += 1 / 60;
    drainInto(tel, run);
  }
  return run;
}

// greedy：串行打 L1→L2→L3，推进率门槛要求到达第 3 关
function greedy(seed) {
  let tel = newTracker('greedy', seed, 1, null);
  let last = null;
  let reached = 1;
  for (const lv of [0, 1, 2]) {
    last = playLevel(lv, 'greedy', seed + lv, tel);
    reached = lv + 1;
    tel.level = reached;
    if (last.state.phase !== 'won') break;
  }
  return finish(tel, last, reached);
}

function random(seed) {
  const tel = newTracker('random', seed, 1, null);
  const run = playLevel(0, 'random', seed, tel);
  return finish(tel, run, 1);
}

function noinput(seed) {
  const tel = newTracker('noinput', seed, 1, null);
  const run = playLevel(0, 'noinput', seed, tel);
  return finish(tel, run, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'bear-dash-run',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} reached=${r.levelsReached}`,
  );
}
