// LIL HERO SAGA · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { policy } from '../src/game/autodrive.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policyName, seed) {
  return {
    id: `${policyName}-1`,
    policy: policyName,
    seed,
    level: 1,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    drain() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'hurt') this.deaths += 1;
        if (e.type === 'cast' || e.type === 'jump') this.actions += 1;
      }
    },
    step(dt) {
      run.step(dt);
      this.simTime = run.state.time;
      this.drain();
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
    levelsReached: run.state.act,
    completed: run.state.phase === 'won',
  };
}

// greedy：向右推进 + 破岩 + 跳坑 + 清怪 + 远程橙电磨 Boss
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const maxSteps = 60 * 120;
  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase !== 'playing') break;
    policy(run);
    if (tel.firstInputAt === null && (run.input.left || run.input.right || run.input.jump)) {
      tel.firstInputAt = run.state.time;
    }
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

// random：随机走/跳/施法，验证输入鲁棒
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const maxSteps = 60 * 120;
  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase !== 'playing') break;
    const roll = rng();
    const inp = { left: roll < 0.2, right: roll > 0.8, jump: roll > 0.94 && roll < 0.97 };
    run.setInput(inp);
    if (tel.firstInputAt === null && (inp.left || inp.right || inp.jump)) tel.firstInputAt = run.state.time;
    if (roll > 0.965) run.cast(['red']);
    if (roll > 0.982) run.cast(['yellow']);
    if (roll > 0.992) run.cast(['blue']);
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死亡基线
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const maxSteps = 60 * 120;
  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase !== 'playing') break;
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'lil-hero-saga',
  genre: 'platformer',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed}`,
  );
}
