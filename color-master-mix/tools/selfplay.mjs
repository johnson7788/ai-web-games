// COLOR MASTER MIX · 自对弈（无头直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，串行打到第 3 关，
// 写 tools/fun/autoplay.json（schema 见 playbook references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';
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
    level: (carried && carried.level) ?? (run.levelIndex + 1),
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
      this.tick(1 / 60);
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

// greedy：选一个亮色，按可解锁顺序把图涂满（封印格随邻居解锁自然打开），并演练一次撤销/魔法填充
function greedyLevel(lv, seed, carried) {
  const run = createRun(lv, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  tel.act(() => run.selectFamily(0));
  tel.act(() => run.selectShade(7));
  if (run.state.magicFillsLeft > 0) tel.act(() => run.magicFill());
  if (run.state.undoStack.length) tel.act(() => run.undo());

  let guard = 0;
  while (run.state.phase === 'playing' && guard < 5000) {
    const t = run.regions.find((r) => !r.colored && r.unlocked);
    if (!t) break;
    tel.act(() => run.tap(t.id));
    guard += 1;
  }
  return finish(tel, run);
}

// random：随机选色/乱点/撤销/魔法，验证输入鲁棒（大概率超时失败）
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = run.level.time + 6;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.12) tel.act(() => run.selectFamily(Math.floor(rng() * GAME.FAMILIES)));
    else if (roll < 0.22) tel.act(() => run.selectShade(Math.floor(rng() * GAME.SHADES)));
    else if (roll < 0.55) tel.act(() => run.tap(Math.floor(rng() * run.state.total)));
    else if (roll < 0.62) tel.act(() => run.undo());
    else if (roll < 0.66) tel.act(() => run.magicFill());
    else tel.tick(1 / 60);
  }
  while (run.state.phase === 'playing' && tel.simTime < run.level.time + 2) tel.tick(1 / 60);
  return finish(tel, run);
}

// noinput：只推进时间，测死时间/自动推进基线（必然超时失败）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = run.level.time + 4;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyLevel(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已进入下一关（1 基）
  }
  return last;
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'color-master-mix',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} level=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
