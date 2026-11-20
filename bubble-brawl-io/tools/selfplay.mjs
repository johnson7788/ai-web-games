// BUBBLE BRAWL IO · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。跑 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, ringClear, mulberry32 } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
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
    simTime: carried?.simTime ?? 0,
    firstInputAt: carried?.firstInputAt ?? null,
    firstSuccessAt: carried?.firstSuccessAt ?? null,
    deaths: carried?.deaths ?? 0,
    actions: carried?.actions ?? 0,
    levelsReached: carried?.levelsReached ?? 1,
    seen: new Set(carried?.seen ?? []),
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
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.levelsReached ?? 1,
    completed: run.state.phase === 'won',
    _tel: tel,
  };
}

function clearToFire(st) {
  if (Math.abs(st.turret.x - WORLD.CX) > 6) return false;
  const dx = st.turret.x - WORLD.CX;
  for (const r of st.rings) if (!ringClear(r, dx)) return false;
  return true;
}

function threatDir(st) {
  for (const s of st.spikes) {
    if (s.y > 220 && s.y < WORLD.TURRET_Y && Math.abs(s.x - st.turret.x) < 80) {
      return s.x <= st.turret.x ? 1 : -1;
    }
  }
  for (const b of st.bubbles) {
    if (b.vy > 0 && b.y > 360 && Math.abs(b.x - st.turret.x) < 56) {
      return b.x <= st.turret.x ? 1 : -1;
    }
  }
  return 0;
}

// ---------------- greedy：回中、躲威胁、缺口对齐就发 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  let curDir = 0;
  const MAX_FRAMES = 90 * 60;
  for (let f = 0; f < MAX_FRAMES; f += 1) {
    if (run.state.phase !== 'playing') break;
    const st = run.state;
    const td = threatDir(st);
    let want = 0;
    if (td !== 0) {
      want = td;
    } else {
      const dx = st.turret.x - WORLD.CX;
      if (Math.abs(dx) > 6) want = dx > 0 ? -1 : 1;
      else want = 0;
    }
    if (want !== curDir) {
      curDir = want;
      tel.act(() => run.move(want));
    }
    if (curDir === 0 && td === 0 && clearToFire(st)) {
      tel.act(() => run.fire());
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let levelsReached = 1;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (last.completed) levelsReached = lv + 2;
    else { levelsReached = lv + 1; break; }
  }
  last.levelsReached = levelsReached;
  return last;
}

// ---------------- random：乱动（不发射，只验证输入鲁棒 + 会失败） ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let curDir = 0;
  const MAX_SEC = 90;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    let want = curDir;
    if (roll < 0.25) want = -1;
    else if (roll < 0.5) want = 1;
    else want = 0;
    if (want !== curDir) {
      curDir = want;
      tel.act(() => run.move(want));
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间与失败存在性 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(1)];
const payload = {
  game: 'bubble-brawl-io',
  genre: 'arcade',
  source: 'bot',
  version: 'm1',
  runs: runs.map(({ _tel, ...rest }) => rest),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} ` +
    `events=${r.uniqueEvents} gap=${r.maxEventGapSec}s completed=${r.completed}`,
  );
}
