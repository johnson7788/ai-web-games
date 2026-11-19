// Ring Fusion · 自对弈（Node 无头，直接 import sim）
// greedy / random / noinput 三策略 → tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, lineFor, STONE } from '../src/game/sim.js';
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
    level: (carried && carried.level) ?? run.state.levelIndex + 1,
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
      }
      this.tick(1 / 60);
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
    completed: run.state.phase === 'won',
  };
}

function tileSize(tile) {
  return tile.filter((v) => v >= 0 || v === STONE).length;
}

function samePotential(run, h, p) {
  const st = run.state;
  const tile = st.hand[h];
  let pot = 0;
  for (let s = 0; s < 3; s += 1) {
    const ic = tile[s];
    if (ic < 0) continue;
    for (let k = 0; k < 3; k += 1) if (st.points[p][k] === ic) pot += 3;
    for (const dir of ['h', 'v', 'd1', 'd2']) {
      const line = lineFor(dir, p);
      if (line.length !== 3) continue;
      let cnt = 0;
      for (const pi of line) {
        const pt = st.points[pi];
        if (pt[0] === ic || pt[1] === ic || pt[2] === ic) cnt += 1;
      }
      pot += cnt * 2;
    }
  }
  return pot;
}

function pickBurstPoint(run) {
  let best = -1;
  let bestN = 0;
  for (let p = 0; p < 9; p += 1) {
    const n = run.state.points[p].filter((v) => v >= 0 || v === STONE).length;
    if (n > bestN) { bestN = n; best = p; }
  }
  return best;
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun({ mode: 'classic', levelIndex, seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  tel.level = levelIndex + 1;
  tel.tick(1 / 60);
  const MAX = 2000;
  for (let step = 0; step < MAX && run.state.phase === 'playing'; step += 1) {
    const moves = run.validMoves();
    if (!moves.length) {
      if (run.state.burstReady) {
        const p = pickBurstPoint(run);
        if (p >= 0) { tel.act(() => run.burst(p)); continue; }
      }
      break;
    }
    let bestMove = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      const pre = run.preview(m.h, m.p);
      let s = 0;
      if (pre.ok) {
        s = pre.removed * 10000 + pre.shattered * 100 + tileSize(run.state.hand[m.h]);
        if (pre.removed === 0) s += samePotential(run, m.h, m.p);
      }
      if (s > bestScore) { bestScore = s; bestMove = m; }
    }
    if (!bestMove) break;
    tel.act(() => run.place(bestMove.h, bestMove.p));
  }
  const out = finish(tel, run);
  out._tel = tel;
  return out;
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv * 101, carried);
    carried = last._tel;
    if (!last.completed) break;
  }
  return last;
}

function random(seed) {
  const run = createRun({ mode: 'classic', levelIndex: 0, seed });
  const tel = makeTracker(run, 'random', seed);
  tel.tick(1 / 60);
  const MAX_SEC = 90;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const moves = run.validMoves();
    if (!moves.length) {
      if (run.state.burstReady) {
        const p = pickBurstPoint(run);
        if (p >= 0) { tel.act(() => run.burst(p)); continue; }
      }
      break;
    }
    const m = moves[Math.floor(Math.random() * moves.length)];
    tel.act(() => run.place(m.h, m.p));
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun({ mode: 'time', levelIndex: 0, seed });
  const tel = makeTracker(run, 'noinput', seed);
  tel.tick(1 / 60);
  const MAX_SEC = 70;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'ring-fusion',
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
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
