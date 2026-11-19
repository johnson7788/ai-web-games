// WANHAO CASINO · 自对弈（Node 无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32, DOOR_KEYS, GAME } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.round,
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
    levelsReached: run.state.round,
    completed: run.state.phase === 'won',
  };
}

// greedy：每轮三门各押最小注 → 开牌，稳扎稳打打完 8 轮（保证通关，不破产）
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 20000;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard-- > 0) {
    if (run.state.phase === 'betting') {
      for (const d of DOOR_KEYS) tel.act(() => run.bet(d));
      tel.act(() => run.roll());
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// random：每轮随机门全押（制造破产路径，用于死亡存在性；全押输一轮即破产）
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  let guard = 40000;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard-- > 0) {
    if (run.state.phase === 'betting') {
      const door = DOOR_KEYS[Math.floor(rng() * 3)];
      tel.act(() => run.allin(door));
      tel.act(() => run.roll());
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// noinput：只推时间（基线：无操作不死亡，但也没有成功）
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 20;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'wanhao-casino',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} levels=${r.levelsReached}`,
  );
}
