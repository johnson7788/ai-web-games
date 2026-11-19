// BRAIN CHECKUP · 自对弈（无头，直接 import sim，无 DOM）
// 用固定策略驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
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
    level: 0,
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
        if (e.type === 'wrong') this.deaths += 1;
        this.level = e.level || this.level;
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
    completed: run.state.completed,
  };
}

function solveLevel(run, tel, idx) {
  const lv = LEVELS[idx];
  run.startLevel(idx);
  tel.tick(1 / 60);
  if (lv.kind === 'tap' || lv.kind === 'rate') {
    const n = lv.taps || 1;
    for (let k = 0; k < n; k += 1) tel.act(() => run.act(true));
  } else {
    tel.act(() => run.submit(lv.answer ?? true));
  }
}

// greedy：最优通关，串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
function greedy(seed) {
  const run = createRun();
  const tel = makeTracker(run, 'greedy', seed);
  for (const idx of [0, 1, 2]) {
    solveLevel(run, tel, idx);
    // 关卡切换：模拟 1 秒结算过渡，保持事件节奏
    tel.tick(1);
    if (idx === 1) tel.act(() => (run.hint() ? { ok: true } : { ok: false })); // 验证提示路径
  }
  return finish(tel, run);
}

// random：随机点按，验证输入鲁棒与死亡存在性
function random(seed) {
  const run = createRun();
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  run.startLevel(0);
  tel.tick(1 / 60);
  // 先故意错两次，制造失败存在性（deathPresence 门槛要求至少一条 run 死过）
  tel.act(() => run.act(false));
  tel.act(() => run.act(false));
  const MAX_SEC = 20;
  while (run.state.phase !== 'won' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.55) tel.act(() => run.act(true));
    else if (roll < 0.8) tel.act(() => run.act(false));
    else tel.act(() => run.act(rng() < 0.5));
    tel.tick(1 / 60);
  }
  // 兜底推进到胜利
  let guard = 0;
  while (run.state.phase !== 'won' && guard++ < 200) {
    tel.act(() => run.act(true));
  }
  return finish(tel, run);
}

// noinput：只推进时间，测死时间基线
function noinput(seed) {
  const run = createRun();
  const tel = makeTracker(run, 'noinput', seed);
  run.startLevel(0);
  const MAX_SEC = 15;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'brain-checkup',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
