// RPS DUEL QI · 自对弈（纯逻辑，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：永远打出克制宗师的手牌，气满就爆发（练到通关/胜负路径）。
// random：随机手牌（验证输入鲁棒 + 死亡存在性）。noinput：不输入（超时基线）。
// 运行：node tools/selfplay.mjs

import { createRun, COUNTER_OF, HANDS, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
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
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    _drain() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
      }
    },
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      this._drain();
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
  tel._drain(); // 收走终局事件（clear/gameover）
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  const lost = run.state.phase === 'lost';
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: lost ? 1 : 0,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.wave,
    completed: run.state.phase === 'won',
  };
}

const MAX_ITER = 20000;

// 永远克制 → 打满 30 回合通关（气满即爆发）
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  run.start();
  tel.tick(1 / 60);
  let guard = 0;
  while ((run.state.phase === 'playing' || run.state.phase === 'settle') && guard++ < MAX_ITER) {
    if (run.state.phase === 'playing') {
      if (run.state.qi >= GAME.QI_MAX) tel.act(() => run.useQi());
      else tel.act(() => run.choose(COUNTER_OF[run.state.bossHand]));
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// 随机手牌 → 大概率怒气涨满输掉
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  run.start();
  tel.tick(1 / 60);
  let guard = 0;
  while ((run.state.phase === 'playing' || run.state.phase === 'settle') && guard++ < MAX_ITER) {
    if (run.state.phase === 'playing') {
      const hand = HANDS[Math.floor(rng() * HANDS.length)];
      tel.act(() => run.choose(hand));
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// 不输入 → 每回合超时，怒气涨满输掉
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  run.start();
  tel.tick(1 / 60);
  let guard = 0;
  while ((run.state.phase === 'playing' || run.state.phase === 'settle') && guard++ < MAX_ITER) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'rps-duel-qi',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
