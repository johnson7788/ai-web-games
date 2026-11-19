// BRAIN MELTER · 自对弈：Node 无头直接 import sim（无 DOM）。
// greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 按确定性解法串行打 L1→L2→L3；random 乱点触发失误；noinput 在限时关挂机到超时。
import { createRun, mulberry32 } from '../src/game/sim.js';
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
    if (gap > 3) idleSec += gap - 3;
  }
  return {
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
}

// greedy：按解法串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedy() {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: 3 + lv });
    const tel = makeTracker(run, 'greedy', 3 + lv, carried);
    for (const id of run.solutionTaps()) {
      if (run.state.phase !== 'playing') break;
      tel.act(() => run.tap(id));
    }
    for (let i = 0; i < 5 && run.state.phase === 'playing'; i += 1) tel.tick(1 / 60);
    last = finish(tel, run);
    if (!last.completed) break;
    carried = tel;
  }
  return last;
}

// random：乱点触发失误（验证输入鲁棒 + 死亡存在性）
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const ids = run.level.items.map((x) => x.id);
  const MAX_SEC = 40;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.8) {
      const id = ids[Math.floor(rng() * ids.length)];
      tel.act(() => run.tap(id));
    } else {
      tel.act(() => run.hint());
    }
  }
  return finish(tel, run);
}

// noinput：限时关挂机到超时（验证倒计时/死时间基线）
function noinput(seed) {
  const run = createRun(10, { seed }); // L11 timeLimit 45
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 50;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(), random(2), noinput(5)];
const payload = {
  game: 'brain-melter',
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
    `actions=${r.actions} deaths=${r.deaths} uniqueEvents=${r.uniqueEvents} completed=${r.completed}`,
  );
}
