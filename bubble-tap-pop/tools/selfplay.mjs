// Bubble Tap Pop · 自对弈（Lead 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 每局跑完写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
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
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'correct' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'wrong' || e.type === 'rockTap' || e.type === 'timeout') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(1 / 60);
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
    levelsReached: run.state.level,
    completed: run.state.phase === 'over',
  };
}

// ---------------- greedy：连点正确到 20 分，再故意点错 3 次走完结算 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const TARGET_SCORE = 20;

  while (run.state.phase === 'playing' && run.state.score < TARGET_SCORE) {
    const b = run.state.bubbles.find((x) => x.kind === 'bubble' && x.color === run.state.target);
    if (!b) break;
    tel.act(() => run.tap(b.id));
    tel.tick(0.12);
  }
  for (let i = 0; i < 3 && run.state.phase === 'playing'; i += 1) {
    const b = run.state.bubbles.find((x) => x.kind === 'bubble' && x.color !== run.state.target);
    if (!b) break;
    tel.act(() => run.tap(b.id));
    tel.tick(0.12);
  }
  let guard = 2000;
  while (run.state.phase !== 'over' && guard-- > 0) tel.tick(0.1);
  return finish(tel, run);
}

// ---------------- random：随机乱点，验证输入鲁棒性 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 6000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (tel.simTime > 40) break;
    if (rng() < 0.6 && run.state.bubbles.length) {
      const idx = Math.floor(rng() * run.state.bubbles.length);
      const b = run.state.bubbles[idx];
      if (b) tel.act(() => run.tap(b.id));
    }
    tel.tick(0.2);
  }
  let g2 = 4000;
  while (run.state.phase !== 'over' && g2-- > 0) tel.tick(0.2);
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测超时/死时间基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 4000;
  while (run.state.phase !== 'over' && guard-- > 0) tel.tick(0.2);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'bubble-tap-pop',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
