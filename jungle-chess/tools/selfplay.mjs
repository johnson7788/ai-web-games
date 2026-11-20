// 斗兽棋 · 自对弈（M1 拥有）
// Node 无头，直接 import sim/rules（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { genMoves, BLUE } from '../src/game/rules.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: (carried && carried.level) ?? run.state.level,
    levelsReached: (carried && carried.levelsReached) ?? run.state.level,
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：用 AI 最优走法串行打 L1→L2→L3（推进率门槛要求到达第 3 关） ----------------
function greedyOnce(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  tel.level = levelIndex + 1;
  tel.levelsReached = Math.max(tel.levelsReached, levelIndex + 1);

  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 400) {
    if (run.state.sideToMove === BLUE) {
      const mv = run.suggestMove(BLUE, 3);
      if (!mv) break;
      tel.act(() => run.makeMove(BLUE, mv.from, mv.to));
    } else {
      tel.tick(1 / 60);
    }
    tel.tick(1 / 60);
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
  }
  return last;
}

// ---------------- random：随机合法走法 vs 随班 AI（完整对局，验证输入鲁棒 + 死亡存在性） ----------------
function random(seed) {
  const run = createRun(6, { seed }); // L7 完整对局
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 3000) {
    if (run.state.sideToMove === BLUE) {
      const ms = genMoves(run.state.board, BLUE);
      if (!ms.length) break;
      const m = ms[Math.floor(rng() * ms.length)];
      tel.act(() => run.makeMove(BLUE, m.from, m.to));
    } else {
      tel.tick(1 / 60);
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun(6, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 30) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'jungle-chess',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lv=${r.levelsReached} completed=${r.completed}`,
  );
}
