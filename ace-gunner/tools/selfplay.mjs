// ACE GUNNER · 自对弈（Node 无头，直接 import sim，无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME, LAYOUT, WORLD } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: carried?.simTime ?? 0,
    firstInputAt: carried?.firstInputAt ?? null,
    firstSuccessAt: carried?.firstSuccessAt ?? null,
    deaths: carried?.deaths ?? 0,
    actions: carried?.actions ?? 0,
    seen: new Set(carried ? [...carried.seen] : []),
    eventTimes: carried ? [...carried.eventTimes] : [0],
    maxWave: carried?.maxWave ?? 0,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      this.maxWave = Math.max(this.maxWave, run.state.wave);
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'kill' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
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
    level: Math.max(1, tel.maxWave),
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: Math.max(1, tel.maxWave),
    completed: run.state.phase === 'won',
  };
}

function nearestEnemy(state) {
  let best = null;
  let bx = Infinity;
  for (const e of state.enemies) {
    if (e.state === 'dead') continue;
    if (e.x < bx) { bx = e.x; best = e; }
  }
  return best;
}

// ---------------- greedy：瞄准最近敌人连射，串行打到第 3 波 ----------------
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_STEPS = 30000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    const st = run.state;
    if (st.phase === 'won' || st.phase === 'lost') break;
    if (st.phase === 'wave') {
      const e = nearestEnemy(st);
      if (e) {
        run.aim(e.x, e.y);
        tel.act(() => run.fire());
      }
    } else if (st.phase === 'upgrade') {
      const pref = ['rapidFire', 'piercingShot', 'tripleShot', 'legShot', 'explosiveTips', 'eagleEyePlus', 'longRange', 'bigQuiver'];
      const pick = pref.find((id) => st.offered.includes(id)) || st.offered[0];
      tel.act(() => run.chooseUpgrade(pick));
      run.nextWave();
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

// ---------------- random：乱按，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_STEPS = 40000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    const st = run.state;
    if (st.phase === 'won' || st.phase === 'lost') break;
    if (st.phase === 'wave') {
      const roll = rng();
      if (roll < 0.4) {
        run.aim(rng() * WORLD.WIDTH, 100 + rng() * 600);
        tel.act(() => run.fire());
      } else if (roll < 0.55) {
        run.aim(rng() * WORLD.WIDTH, 100 + rng() * 600);
        tel.act(() => run.reload());
      } else if (roll < 0.7) {
        run.aim(rng() * WORLD.WIDTH, 100 + rng() * 600);
        run.pressFire();
      } else if (roll < 0.85) {
        run.releaseFire();
      }
    } else if (st.phase === 'upgrade') {
      const pick = st.offered[Math.floor(rng() * st.offered.length)] || st.offered[0];
      run.chooseUpgrade(pick);
      run.nextWave();
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，验证无死时间基线 + 会失败 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 40000;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    tel.tick(DT);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'ace-gunner',
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
    `actions=${r.actions} deaths=${r.deaths} wave=${r.levelsReached} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
