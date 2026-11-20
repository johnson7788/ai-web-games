// KILN 2048 · 自对弈（无头 Node，直接 import sim，零 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// schema 见 skills/webgame-playbook/references/playtest-protocol.md §3。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { boardSettled, bestDropX } from '../src/game/ai.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const GREEDY_SEED = 3; // 已验证可串行通关 L1→L2→L3

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

function finish(tel, run, levelsReached) {
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

// ---------------- greedy：串行打 L1→L2→L3，合成优先 + 有序堆叠 ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  const LEVEL_MAX = 90;
  while (run.state.phase === 'playing' && run._clock < LEVEL_MAX) {
    tel.tick(1 / 60);
    if (run.state.held && boardSettled(run.state)) {
      tel.act(() => run.setDropX(bestDropX(run)));
      tel.act(() => run.drop());
    }
  }
  return { run, tel };
}

function greedy(seed) {
  let carried = null;
  let last = null;
  let reached = 1;
  for (const lv of [0, 1, 2]) {
    const { run, tel } = greedyOnce(lv, seed + lv * 97, carried);
    reached = lv + 1;
    last = finish(tel, run, reached);
    carried = tel;
    if (run.state.phase !== 'won') break;
  }
  return last;
}

// ---------------- random：中心乱倒（保证堆高判负，验证输入鲁棒与边界） ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const cx = (run.state.kiln.left + run.state.kiln.right) / 2;
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
    if (run.state.held && boardSettled(run.state)) {
      tel.act(() => run.setDropX(cx)); // 中心乱倒：堆高判负
      tel.act(() => run.drop());
    }
  }
  return finish(tel, run, 1);
}

// ---------------- noinput：什么都不做，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run, 1);
}

const runs = [greedy(GREEDY_SEED), random(3), noinput(3)];
const payload = {
  game: 'kiln-2048',
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
    `actions=${r.actions} deaths=${r.deaths} lv=${r.levelsReached} events=${r.uniqueEvents} ` +
    `maxGap=${r.maxEventGapSec}s idle=${r.idleSec}s completed=${r.completed}`,
  );
}
