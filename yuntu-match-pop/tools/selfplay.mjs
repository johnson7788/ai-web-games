// YUNTU MATCH POP · 自对弈
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
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
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    ingest(events) {
      for (const e of events) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'merge' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      this.ingest(run.drainEvents());
    },
    flush() {
      this.ingest(run.drainEvents());
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

function finish(tel, run, levelsReached) {
  tel.flush();
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
    level: levelsReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

// 贪心列选择：优先「列顶 == 下一块」立即合成，否则最矮非满列（平铺底行）。
function greedyCol(run) {
  const st = run.state;
  let chosen = -1;
  for (let c = 0; c < st.cols; c += 1) {
    const col = st.grid[c];
    if (col.length && col[col.length - 1].v === st.nextValue && col.length < st.rows) { chosen = c; break; }
  }
  if (chosen < 0) {
    let bestH = Infinity;
    for (let c = 0; c < st.cols; c += 1) {
      if (st.grid[c].length < st.rows && st.grid[c].length < bestH) { bestH = st.grid[c].length; chosen = c; }
    }
  }
  return chosen;
}

function playUntilEnd(run, tel, cap) {
  let guard = cap;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (run.state.busy > 0) { tel.tick(1 / 60); continue; }
    const col = greedyCol(run);
    if (col < 0) break;
    if (!tel.act(() => run.place(col)).ok) break;
    while (run.state.busy > 0 && run.state.phase === 'playing') tel.tick(1 / 60);
  }
}

// greedy：串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedy(seed) {
  let carried = null;
  let reached = 1;
  let lastRun = null;
  let lastTel = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { seed: seed + lv });
    const tel = makeTracker(run, 'greedy', seed, carried);
    lastRun = run;
    lastTel = tel;
    reached = lv + 1;
    playUntilEnd(run, tel, 80000);
    carried = tel;
    if (run.state.phase !== 'won') break;
  }
  return finish(lastTel, lastRun, reached);
}

// random：随机乱点，验证输入鲁棒 + 必然走向满列死亡（deathPresence 证据）。
// 打第 9 关（目标 8192，岩石密集）：随机永远到不了目标，最终满列 → lose。
function random(seed) {
  const run = createRun(8, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 400000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (run.state.busy > 0) { tel.tick(1 / 60); continue; }
    const col = Math.floor(rng() * run.state.cols);
    if (!tel.act(() => run.place(col)).ok) break;
    while (run.state.busy > 0 && run.state.phase === 'playing') tel.tick(1 / 60);
  }
  // 兜底：还没死就逐个填满非满列，确保触发 full → lose
  let guard2 = 200000;
  while (run.state.phase === 'playing' && guard2-- > 0) {
    if (run.state.busy > 0) { tel.tick(1 / 60); continue; }
    let placed = false;
    for (let c = 0; c < run.state.cols; c += 1) {
      if (run.state.grid[c].length < run.state.rows) {
        tel.act(() => run.place(c));
        placed = true;
        break;
      }
    }
    if (!placed) break;
    while (run.state.busy > 0 && run.state.phase === 'playing') tel.tick(1 / 60);
  }
  return finish(tel, run, 9);
}

// noinput：只推进时间，测自动推进/死时间基线
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const SEC = 20;
  for (let i = 0; i < SEC * 60; i += 1) tel.tick(1 / 60);
  return finish(tel, run, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'yuntu-match-pop',
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
