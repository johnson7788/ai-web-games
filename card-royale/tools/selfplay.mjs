// CARD ROYALE · 自对弈（M1 拥有）
// Node 无头，直接 import sim/solver（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 L1→L2→L3 并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { findWin } from '../src/game/solver.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

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
    if (gap > 4) idleSec += gap - 4;
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：用求解器找到清场路径，串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const moves = findWin(run.snapshot());
  if (!moves) return finish(tel, run);
  for (const mv of moves) {
    if (run.state.phase !== 'playing') break;
    tel.act(() => run.executeMove(mv));
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
  }
  return last;
}

// ---------------- random：乱按，验证输入鲁棒与失败路径 ----------------
function random(seed) {
  const run = createRun(1, { seed }); // L2 三峰，随机几乎不可能误通
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 90;
  let guard = 0;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC && guard < 20000) {
    guard += 1;
    const roll = rng();
    const playable = run.playableCards();
    const frozenUncovered = run.state.board.filter((c) => c.frozen && !c.thawed && run.isUncovered(c));
    if (playable.length && roll < 0.35) {
      const c = playable[Math.floor(rng() * playable.length)];
      tel.act(() => run.play(c.id));
    } else if (frozenUncovered.length && roll < 0.5) {
      const c = frozenUncovered[Math.floor(rng() * frozenUncovered.length)];
      tel.act(() => run.thaw(c.id));
    } else if (roll < 0.8) {
      tel.act(() => run.draw());
    } else {
      tel.act(() => run.redeal());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/自动推进基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (tel.simTime < MAX_SEC && run.state.phase === 'playing') tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(13), noinput(3)];
const payload = {
  game: 'card-royale',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} levels=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
