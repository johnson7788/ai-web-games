// REEF RAIDER · 自对弈：Node 无头，直接 import sim（无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）；random/noinput 作基线与死时间证据。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME, LAYOUT } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const TURRET = { x: LAYOUT.TURRET_X, y: LAYOUT.TURRET_Y };

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
        if (e.type === 'capture' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

function aimAt(f) {
  const t = Math.hypot(f.x - TURRET.x, f.y - TURRET.y) / GAME.BULLET_SPEED;
  const fx = f.x + (f.vx || 0) * t;
  const fy = f.y + (f.vy || 0) * t;
  return Math.atan2(fx - TURRET.x, -(fy - TURRET.y));
}

function optimalPower(f) {
  return Math.max(1, Math.min(GAME.POWER_MAX, Math.ceil(f.hp / 8)));
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_SEC = LEVELS[levelIndex].time + 5;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    let best = null;
    let bestVal = -1;
    for (const f of run.state.fish) {
      if (!f.alive) continue;
      const val = f.gold / Math.max(1, f.hp / 2);
      if (val > bestVal) { bestVal = val; best = f; }
    }
    if (best) {
      tel.act(() => run.setPower(optimalPower(best)));
      tel.act(() => run.fire(aimAt(best)));
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const level = LEVELS[0];
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.4) {
      tel.act(() => run.fire(rng() * Math.PI * 2 - Math.PI / 2));
    } else if (roll < 0.6) {
      tel.act(() => run.setPower(1 + Math.floor(rng() * 5)));
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const level = LEVELS[0];
  const MAX_SEC = level.time + 5;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
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
  }
  return last;
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'reef-raider',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} levels=${r.levelsReached}`,
  );
}
