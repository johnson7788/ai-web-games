// SLICE LAB · 自对弈（Node 无头，直接 import sim）
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32, BISECT_DIRECTIONS } from '../src/game/sim.js';
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
    combo: (carried && carried.combo) ?? 0,
    levelsReached: (carried && carried.levelsReached) ?? run.state.level,
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// greedy：每关用面积二分求等分线（自动绕开岩核），连续打 L1→L2→L3
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed, combo: carried ? carried.combo : 0 });
  const tel = makeTracker(run, 'greedy', seed, carried);
  let line = null;
  for (const d of BISECT_DIRECTIONS) {
    const l = run.bisect(d);
    if (l) { line = l; break; }
  }
  if (line) tel.act(() => run.cut(line.p1.x, line.p1.y, line.p2.x, line.p2.y));
  let guard = 60 * 60;
  while ((run.state.phase === 'drawing' || run.state.phase === 'splitting') && guard-- > 0) {
    tel.tick(1 / 60);
  }
  tel.combo = run.state.combo;
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let lastRun = null;
  let maxLevel = 0;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyOnce(lv, seed + lv, carried);
    carried = tel;
    lastRun = run;
    maxLevel = Math.max(maxLevel, lv + 1);
    if (run.state.phase !== 'won') break;
    carried.levelsReached = lv + 2; // 已进入下一关（1 基）
  }
  const out = finish(carried, lastRun);
  out.levelsReached = maxLevel;
  out.level = Math.min(3, maxLevel);
  return out;
}

// random：在包围盒两侧随机取点划刀，验证输入鲁棒（大概率失败）
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = LEVELS[0].time + 6;
  while (run.state.phase === 'drawing' && tel.simTime < MAX_SEC) {
    const pts = run.state.shape;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const p1 = { x: minX - 70 + rng() * (maxX - minX + 140), y: minY - 70 + rng() * (maxY - minY + 140) };
    const p2 = { x: minX - 70 + rng() * (maxX - minX + 140), y: minY - 70 + rng() * (maxY - minY + 140) };
    tel.act(() => run.cut(p1.x, p1.y, p2.x, p2.y));
    tel.tick(1 / 60);
  }
  while (run.state.phase === 'splitting') tel.tick(1 / 60);
  return finish(tel, run);
}

// noinput：只推进时间，测自动推进/死时间基线（超时判负）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = LEVELS[0].time + 6;
  while (run.state.phase === 'drawing' && tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'slice-lab',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
