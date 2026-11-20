// DUNE TAC TOE · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, createEndless, X, winner, empties, mulberry32, winningMoves, drawingMoves } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const TURN_DT = 1.2; // 每次落子的虚拟耗时（秒）

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: (carried && carried.level) ?? run.state.level,
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
        this.tick(TURN_DT);
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
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won' || run.state.phase === 'draw',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：谜题必胜格串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const s = run.state;
  let guard = 60;
  while (s.phase === 'playing' && guard-- > 0) {
    if (s.goal === 'draw') {
      const dm = drawingMoves(s.board);
      if (!dm.length) break;
      tel.act(() => run.place(dm[0]));
    } else {
      const k = s.movesLimit - s.movesMade;
      const wm = winningMoves(s.board, k);
      if (!wm.length) break;
      const imm = wm.find((e) => { const nb = s.board.slice(); nb[e] = X; return winner(nb) === X; });
      tel.act(() => run.place(imm != null ? imm : wm[0]));
    }
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    carried.level = lv + 1;
    if (!last.completed) break;
  }
  last.levelsReached = carried.level;
  delete last._tel;
  return last;
}

// ---------------- random：乱按 L3（win-in-2，几乎必负） ----------------
function random(seed) {
  const run = createRun(2, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 60;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const es = empties(run.state.board);
    const cell = es[Math.floor(rng() * es.length)];
    tel.act(() => run.place(cell));
  }
  return finish(tel, run);
}

// ---------------- noinput：只推时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'dune-tac-toe',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
