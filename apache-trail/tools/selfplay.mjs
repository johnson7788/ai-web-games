// APACHE TRAIL · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成 L1→L3 并写出 tools/fun/autoplay.json（schema 见 playtest-protocol.md §3）。
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { PLAYER } from '../config/game.config.js';
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
        if (e.type === 'death') this.deaths += 1;
      }
    },
    act(fn) {
      fn();
      this.actions += 1;
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      this.tick(1 / 60);
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
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：向右跑，遇缺口/地面刺就跳 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const level = LEVELS[levelIndex];
  const tel = makeTracker(run, 'greedy', seed, tel0);
  tel.act(() => run.setMove(1)); // 首个输入：向右

  const supportAt = (x, feet) => {
    let best = Infinity;
    for (const pl of level.platforms) {
      if (x >= pl.x && x <= pl.x + pl.w && pl.y >= feet - 6 && pl.y <= feet + 30) {
        best = Math.min(best, pl.y);
      }
    }
    return best;
  };

  const MAX = 90 * 60; // 90s 兜底
  for (let i = 0; i < MAX && run.state.phase === 'playing'; i += 1) {
    const p = run.state.player;
    const feet = p.y + PLAYER.H;
    const ahead = p.x + PLAYER.W + 46;
    const gap = supportAt(ahead, feet) > feet + 24;
    const obs = level.hazards.some((h) =>
      h.type === 'spike' && h.x < p.x + PLAYER.W + 46 && h.x + h.w > p.x + PLAYER.W - 2,
    );
    if ((gap || obs) && p.onGround) {
      tel.act(() => run.pressJump());
    } else {
      tel.tick(1 / 60);
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
    if (!last.completed) break;
  }
  return last;
}

// ---------------- random：随机左右漂移（活跃 + 撞刺死亡） ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let dir = 1;
  let lastDir = 0;
  let steps = 0;
  tel.act(() => run.setMove(1));
  lastDir = 1;

  const MAX = 45 * 60;
  while (run.state.phase === 'playing' && steps < MAX) {
    steps += 1;
    if (steps % 9 === 0) {
      dir = rng() < 0.55 ? 1 : -1;
      if (dir !== lastDir) {
        tel.act(() => run.setMove(dir));
        lastDir = dir;
        continue;
      }
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX = (LEVELS[0].time + 5) * 60;
  let steps = 0;
  while (run.state.phase === 'playing' && steps < MAX) {
    steps += 1;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'apache-trail',
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
    `actions=${r.actions} deaths=${r.deaths} levelsReached=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents} maxGap=${r.maxEventGapSec.toFixed(1)}s idle=${r.idleSec.toFixed(1)}s`,
  );
}
