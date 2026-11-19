// HAPPY POP CRUSH · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成若干关并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
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
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：始终选一个「能产生消除」的交换，无解则洗牌 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const INTERVAL = 0.4;
  let lastAct = 0;
  let guard = 200000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (tel.simTime - lastAct >= INTERVAL) {
      const mv = run.findMove();
      if (mv) tel.act(() => run.swap(mv.a, mv.b));
      else tel.act(() => run.shuffle());
      lastAct = tel.simTime;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：随机相邻交换，验证输入鲁棒 + 制造死亡样本 ----------------
// 用 L3（目标 2500/16 步/6 色）：乱按几乎不可能达标，必然耗尽步数失败，稳定产出死亡样本。
function random(seed) {
  const run = createRun(2, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const INTERVAL = 0.12;
  const MAX_SEC = 90;
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let lastAct = -1;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    if (tel.simTime - lastAct >= INTERVAL) {
      let swapped = false;
      for (let att = 0; att < 60 && !swapped; att += 1) {
        const r = Math.floor(rng() * run.state.rows);
        const c = Math.floor(rng() * run.state.cols);
        const d = dirs[Math.floor(rng() * 4)];
        const r2 = r + d[0];
        const c2 = c + d[1];
        if (r2 < 0 || r2 >= run.state.rows || c2 < 0 || c2 >= run.state.cols) continue;
        const res = tel.act(() => run.swap({ r, c }, { r: r2, c: c2 }));
        if (res && res.ok) swapped = true;
      }
      lastAct = tel.simTime;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 20;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
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

const runs = [greedy(3), random(2), noinput(3)].map((r) => {
  const { _tel, ...pub } = r;
  return pub;
});
const payload = {
  game: 'happy-pop-crush',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
