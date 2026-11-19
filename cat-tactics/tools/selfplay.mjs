// CAT TACTICS · 自对弈（无头 Node，直接 import sim）
// greedy / random / noinput 三策略 → tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, SLOT_COUNT, MAX_RUNNING, LEVEL_MAX } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const BOOST_COST = GAME.BOOST_COST;

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.mission,
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
        if ((e.type === 'win' || e.type === 'mission') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.mission,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.mission,
    completed: run.state.phase === 'won',
  };
}

function findMergePair(run) {
  let best = null;
  for (let a = 0; a < SLOT_COUNT; a += 1) {
    for (let b = a + 1; b < SLOT_COUNT; b += 1) {
      const ca = run.state.slots[a];
      const cb = run.state.slots[b];
      if (!ca || !cb || ca.level !== cb.level || ca.level >= LEVEL_MAX) continue;
      const parkedBonus = (ca.running ? 0 : 1) + (cb.running ? 0 : 1);
      const score = ca.level * 10 + parkedBonus;
      if (!best || score > best.score) best = { a, b, score };
    }
  }
  return best;
}

function firstEmpty(run) {
  for (let i = 0; i < SLOT_COUNT; i += 1) if (!run.state.slots[i]) return i;
  return -1;
}

function bestDeploy(run) {
  let idx = -1;
  let lvl = -1;
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const c = run.state.slots[i];
    if (c && !c.running && c.level > lvl) { idx = i; lvl = c.level; }
  }
  return idx;
}

function parkedLowest(run) {
  let idx = -1;
  let lvl = Infinity;
  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const c = run.state.slots[i];
    if (c && !c.running && c.level < lvl) { idx = i; lvl = c.level; }
  }
  return idx;
}

// ---------------- greedy ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 600000) {
    guard += 1;
    const pair = findMergePair(run);
    if (pair) {
      if (run.state.slots[pair.a].running) tel.act(() => run.stop(pair.a));
      if (run.state.slots[pair.b].running) tel.act(() => run.stop(pair.b));
      tel.act(() => run.merge(pair.a, pair.b));
      continue;
    }
    const empty = firstEmpty(run);
    if (empty >= 0 && run.state.coins >= run.state.recruitCost) {
      tel.act(() => run.buy());
      continue;
    }
    if (run.state.runningCount < MAX_RUNNING) {
      const d = bestDeploy(run);
      if (d >= 0) { tel.act(() => run.deploy(d)); continue; }
    }
    if (run.state.coins >= BOOST_COST && run.state.boostLeft <= 0 && run.state.incomePerSec > 0) {
      tel.act(() => run.boost());
      continue;
    }
    if (run.state.incomePerSec > 0) {
      tel.tick(1 / 60);
      continue;
    }
    const l0 = parkedLowest(run);
    if (l0 >= 0) {
      tel.act(() => run.recycle(l0));
      continue;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  // 简单确定性 RNG
  let s = (seed * 7919 + 13) >>> 0;
  const rng = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const CAP = 150;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    const roll = rng();
    if (roll < 0.35) {
      tel.act(() => run.buy());
    } else if (roll < 0.55) {
      const pair = findMergePair(run);
      if (pair) tel.act(() => run.merge(pair.a, pair.b));
      else tel.act(() => run.buy());
    } else if (roll < 0.7) {
      const d = bestDeploy(run);
      if (d >= 0) tel.act(() => run.deploy(d));
    } else if (roll < 0.8) {
      const l0 = parkedLowest(run);
      if (l0 >= 0) tel.act(() => run.recycle(l0));
    } else if (roll < 0.9) {
      tel.act(() => run.boost());
    } else {
      tel.tick(1 / 60);
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 400) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'cat-tactics',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} ` +
    `levels=${r.levelsReached} completed=${r.completed}`,
  );
}
