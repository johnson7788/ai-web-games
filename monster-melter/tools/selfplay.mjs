// MONSTER MELTER · 自对弈：greedy / random / noinput 三策略 → tools/fun/autoplay.json
// 纯 sim 无 DOM。固定 seed 驱动，产物 schema 见 playtest-protocol §3。
import { createRun, mulberry32, CELLS, LINES } from '../src/game/sim.js';
import { greedyMove } from '../src/game/ai.js';
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
  };
}

function doAction(tel, run, fn) {
  const res = fn();
  if (res && res.ok) {
    tel.actions += 1;
    if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
  }
  tel.tick(1 / 60);
  return res;
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
    level: run.state.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
}

function bestBombCell(run) {
  let best = 30;
  let bestScore = -1;
  for (const cell of CELLS) {
    let score = 0;
    for (const other of CELLS) {
      const d = Math.hypot(other.x - cell.x, other.y - cell.y);
      if (d <= 1.75 * 110 && run.state.board[other.index].kind !== 'empty') score += 1;
    }
    if (score > bestScore) { bestScore = score; best = cell.index; }
  }
  return best;
}

function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, {
    seed,
    score: (carried && carried.score) ?? 0,
    bombs: (carried && carried.bombs) ?? 1,
  });
  const tel = makeTracker(run, 'greedy', seed, carried);
  let guard = 5000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const m = greedyMove(run);
    if (m) doAction(tel, run, () => run.place(m.ti, m.a));
    else if (run.state.bombs > 0) doAction(tel, run, () => run.useBomb(bestBombCell(run)));
    else break;
  }
  const out = finish(tel, run);
  out._carry = { score: run.state.score, bombs: run.state.bombs };
  return out;
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = { ...(last._carry || {}), simTime: last.durationSec, firstInputAt: last.firstInputSec, firstSuccessAt: last.firstSuccessSec, deaths: last.deaths, actions: last.actions, seen: [], eventTimes: [0] };
    if (!last.completed) break;
  }
  delete last._carry;
  // 由于贪心串行打多关，levelsReached 取最后一次的 level（1 基）
  return last;
}

function listMoves(run) {
  const moves = [];
  const st = run.state;
  for (let ti = 0; ti < 3; ti += 1) {
    const tray = st.trays[ti];
    if (!tray) continue;
    for (let a = 0; a < CELLS.length; a += 1) {
      if (!run.canPlace(ti, a)) continue;
      const targets = run.resolveTargets(a, tray.shape);
      const tset = new Set(targets);
      let clears = 0;
      for (const line of LINES) {
        let filled = 0;
        for (const i of line) if (st.board[i].kind === 'gem') filled += 1;
        let add = 0;
        for (const i of line) if (tset.has(i)) add += 1;
        if (filled + add === line.length) clears += 1;
      }
      moves.push({ ti, a, clears });
    }
  }
  return moves;
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 3000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const moves = listMoves(run);
    if (moves.length) {
      // 乱按策略：优先「不成线」的落点，尽快把棋盘填死 → 触发失败路径（死亡基线）
      const nonClear = moves.filter((m) => m.clears === 0);
      const pool = nonClear.length ? nonClear : moves;
      const m = pool[Math.floor(rng() * pool.length)];
      doAction(tel, run, () => run.place(m.ti, m.a));
    } else if (run.state.bombs > 0) {
      doAction(tel, run, () => run.useBomb(bestBombCell(run)));
    } else {
      break;
    }
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 600;
  while (run.state.phase === 'playing' && guard-- > 0) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'monster-melter',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
