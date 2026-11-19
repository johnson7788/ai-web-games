// Pirate Escape Run · 自对弈（M1）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

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
    drain(t) {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(t);
        if (this.firstSuccessAt === null && (e.type === 'coin' || e.type === 'star' || e.type === 'box')) {
          this.firstSuccessAt = t;
        }
        if (e.type === 'death') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      this.actions += 1;
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
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
    levelsReached: run.state.tier,
    completed: false,
  };
}

// ---------------- greedy：预判下一行木板，走安全道，爬到 tier 3（score≥70） ----------------
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const TARGET = 70;
  const CLIMB_INTERVAL = 0.25;
  let t = 0;
  let nextClimbAt = 0;
  const MAX_SEC = 120;
  while (run.state.alive && run.state.score < TARGET && t < MAX_SEC) {
    if (t >= nextClimbAt) {
      const next = run.peek(run.state.score + 1);
      const lane = next.barrier === -1 ? 1 : next.barrier === 1 ? 0 : run.state.lane;
      tel.act(() => run.move(lane));
      nextClimbAt += CLIMB_INTERVAL;
    }
    run.tick(DT);
    tel.drain(t);
    tel.simTime += DT;
    t += DT;
  }
  // 收尾：排空剩余事件
  tel.drain(t);
  return finish(tel, run);
}

// ---------------- random：随机换道/间隔，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let t = 0;
  let nextTap = rng() * 0.5;
  const MAX_SEC = 120;
  while (run.state.alive && t < MAX_SEC) {
    if (t >= nextTap) {
      tel.act(() => run.move(rng() < 0.5 ? 0 : 1));
      nextTap = t + 0.15 + rng() * 0.5;
    }
    run.tick(DT);
    tel.drain(t);
    tel.simTime += DT;
    t += DT;
  }
  tel.drain(t);
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死亡基线 ----------------
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  let t = 0;
  const MAX_SEC = 20;
  while (run.state.alive && t < MAX_SEC) {
    run.tick(DT);
    tel.drain(t);
    tel.simTime += DT;
    t += DT;
  }
  tel.drain(t);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'pirate-escape-run',
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
    `actions=${r.actions} deaths=${r.deaths} tier=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
