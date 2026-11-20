// NOTE RIDER · 自对弈
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
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
        if ((e.type === 'hit' || e.type === 'kill' || e.type === 'holdComplete') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
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
  out._tel = tel;
  return out;
}

// 完美自动演奏：在判定窗内换到对应轨道并斩击
function autoplayTick(run) {
  const s = run.state;
  for (const n of s.notes) {
    if (n.resolved || n.type === 'red') continue;
    const dt = s.beatClock - n.start;
    if (Math.abs(dt) <= 0.05) {
      if (n.lane !== s.lane) run.switchLane(n.lane);
      run.slash();
      return true;
    }
  }
  return false;
}

// ---------------- greedy：完美演奏，串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const CAP = run.state.chartDuration + 4;
  while (run.state.phase === 'playing') {
    tel.act(() => {
      const did = autoplayTick(run);
      return { ok: did };
    });
    tel.tick(1 / 60);
    if (run.state.beatClock >= CAP) break;
  }
  // 兜底：把残余推进到终局
  let guard = 600;
  while (guard-- > 0 && run.state.phase === 'playing') {
    autoplayTick(run);
    tel.tick(1 / 60);
    if (run.state.beatClock >= CAP) break;
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
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：随机斩击/换轨，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const CAP = run.state.chartDuration + 4;
  let nextAct = 0.3;
  while (run.state.phase === 'playing' && run.state.beatClock < CAP) {
    if (run.state.beatClock >= nextAct) {
      const roll = rng();
      if (roll < 0.5) tel.act(() => run.slash());
      else if (roll < 0.8) tel.act(() => run.switchLane(rng() < 0.5 ? 0 : 1));
      nextAct = run.state.beatClock + 0.3 + rng() * 0.5;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const CAP = run.state.chartDuration + 4;
  while (run.state.phase === 'playing' && run.state.beatClock < CAP) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'note-rider',
  genre: 'action',
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
