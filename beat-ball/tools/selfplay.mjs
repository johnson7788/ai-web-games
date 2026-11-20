// BEAT BALL · 自对弈（无头，直接 import sim，无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const NOINPUT_LEVEL = 0;   // 单轨，验证自动推进与死亡
const RANDOM_LEVEL = 2;    // 三轨，验证横移输入鲁棒

function makeTracker(run, policy, seed, carried) {
  return {
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
    levelsReached: (carried && carried.levelsReached) ?? run.state.level,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      return res;
    },
  };
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
  const out = {
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// 判断某轨道在指定时刻是否安全（无鼓槌）
function laneIsSafe(run, lane, t) {
  return !run.state.obstacles.some(
    (o) => o.kind === 'hazard' && !o.resolved && o.lane === lane && Math.abs(o.t - t) < 1e-6,
  );
}

// 贪心一步：先保命，再抢拍。动作统一走 tel.act，便于计数遥测。
function greedyStep(run, tel) {
  const s = run.state;
  const now = s.clock;
  const upcoming = s.obstacles.filter((o) => !o.resolved && o.t >= now - 1e-6);
  const nextHazard = upcoming.find((o) => o.kind === 'hazard');
  const nextPad = upcoming.find((o) => o.kind === 'pad');

  if (s.lanes === 1) {
    if (nextHazard && nextHazard.t - now < 0.34 && !s.playerJumping) tel.act(() => run.jump());
    return;
  }

  // 保命：当前轨即将落槌则横移
  if (nextHazard && nextHazard.t - now < 0.85 && s.playerLane === nextHazard.lane) {
    const hazardsAtT = new Set(
      upcoming.filter((o) => o.kind === 'hazard' && Math.abs(o.t - nextHazard.t) < 1e-6).map((o) => o.lane),
    );
    let target = null;
    const padAtT = upcoming.find((o) => o.kind === 'pad' && Math.abs(o.t - nextHazard.t) < 1e-6);
    if (padAtT && !hazardsAtT.has(padAtT.lane)) target = padAtT.lane;
    else {
      for (let lane = 0; lane < s.lanes; lane += 1) {
        if (!hazardsAtT.has(lane)) { target = lane; break; }
      }
    }
    if (target != null && target !== s.playerLane) tel.act(() => run.move(target > s.playerLane ? 1 : -1));
    return;
  }

  // 抢拍：朝最近的节拍点靠（前提是目标轨在该拍安全，且中间无更早鼓槌）
  if (nextPad && nextPad.t - now < 1.5 && nextPad.lane !== s.playerLane && laneIsSafe(run, nextPad.lane, nextPad.t)) {
    const earlier = upcoming.some(
      (o) => o.kind === 'hazard' && o.t < nextPad.t && o.lane === nextPad.lane,
    );
    if (!earlier) tel.act(() => run.move(nextPad.lane > s.playerLane ? 1 : -1));
  }
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  tel.level = run.state.level;
  tel.levelsReached = Math.max(tel.levelsReached, run.state.level);
  const STEP = 1 / 60;
  const CAP = Math.ceil(run.state.duration * 60) + 240;
  for (let i = 0; i < CAP && run.state.phase === 'playing'; i += 1) {
    greedyStep(run, tel);
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
    carried.levelsReached = lv + 2;
  }
  return last;
}

function random(seed) {
  const run = createRun(RANDOM_LEVEL, { seed });
  const tel = makeTracker(run, 'random', seed);
  tel.levelsReached = Math.max(tel.levelsReached, run.state.level);
  const rng = mulberry32(seed * 7919 + 13);
  const STEP = 1 / 60;
  const CAP = Math.ceil(run.state.duration * 60) + 120;
  let sinceAct = 0;
  for (let i = 0; i < CAP && run.state.phase === 'playing'; i += 1) {
    sinceAct += STEP;
    if (sinceAct >= 0.18) {
      sinceAct = 0;
      const roll = rng();
      if (roll < 0.4) tel.act(() => run.move(rng() < 0.5 ? -1 : 1));
      else if (roll < 0.7) tel.act(() => run.jump());
    }
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(NOINPUT_LEVEL, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  tel.levelsReached = Math.max(tel.levelsReached, run.state.level);
  const STEP = 1 / 60;
  const CAP = Math.ceil(run.state.duration * 60) + 60;
  for (let i = 0; i < CAP && run.state.phase === 'playing'; i += 1) tel.tick(STEP);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'beat-ball',
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
