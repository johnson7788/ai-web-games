// CAT VS DOG WAR · 自对弈（无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写完 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
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
    step(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'kill') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    tap(i) {
      const res = run.tapHole(i);
      if (res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.step(1 / 60);
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
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// greedy：只点有动物的洞（避开石头），直到终局
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_STEPS = 60 * 60 * 3; // 3 分钟上限
  for (let s = 0; s < MAX_STEPS && run.state.phase === 'playing'; s += 1) {
    let target = -1;
    for (let i = 0; i < 5; i += 1) {
      const m = run.state.holes[i].monster;
      if (m && m.type !== 'rock') { target = i; break; }
    }
    if (target >= 0) tel.tap(target);
    else tel.step(1 / 60);
  }
  return finish(tel, run);
}

// random：随机乱点（验证输入鲁棒 + 作为「会失败」的基线，确保死亡存在性）
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_STEPS = 60 * 60 * 2;
  let sinceTap = 0;
  for (let s = 0; s < MAX_STEPS && run.state.phase === 'playing'; s += 1) {
    sinceTap += 1;
    if (sinceTap >= 10) { // 每 1/6s 乱点一次
      sinceTap = 0;
      tel.tap(Math.floor(rng() * 5));
    } else {
      tel.step(1 / 60);
    }
  }
  return finish(tel, run);
}

// noinput：只推进时间，验证自动推进/失败基线
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 60 * 60;
  for (let s = 0; s < MAX_STEPS && run.state.phase === 'playing'; s += 1) {
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'cat-vs-dog-war',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
