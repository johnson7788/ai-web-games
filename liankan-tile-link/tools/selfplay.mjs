// LIANKAN TILE LINK · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成对局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const LEVEL_INDEX = 0;

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level + 1,
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
        if ((e.type === 'win' || e.type === 'match') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

function skipMemorize(run, tel) {
  let guard = 2000;
  while (run.state.phase === 'memorize' && guard-- > 0) tel.tick(0.05);
}

function solveRun(run, tel, maxSteps = 4000) {
  skipMemorize(run, tel);
  let steps = 0;
  while (run.state.phase === 'playing' && steps++ < maxSteps) {
    if (run.state.simTime < run.state.lockedUntil) { tel.tick(0.05); continue; }
    const st = run.state;
    const byName = {};
    for (const c of st.cards) if (!c.matched) (byName[c.name] = byName[c.name] || []).push(c.id);
    const name = Object.keys(byName).find((n) => byName[n].length >= st.groupOf);
    if (!name) { tel.tick(0.05); continue; }
    for (const id of byName[name]) tel.act(() => run.showCard(id));
    tel.tick(0.4);
  }
  let guard = 2000;
  while (run.state.phase === 'playing' && guard-- > 0) tel.tick(0.05);
}

// ---------------- greedy：串行打 L1→L2→L3（推进率门槛要求到达第 3 关） ----------------
function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const run = createRun(lv, { mode: 'timed', seed: seed + lv });
    const tel = makeTracker(run, 'greedy', seed + lv, carried);
    solveRun(run, tel);
    last = finish(tel, run);
    if (!last.completed) break;
    carried = last._tel;
  }
  return last;
}

// ---------------- random：随机翻牌/窥视，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(LEVEL_INDEX, { mode: 'timed', seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  skipMemorize(run, tel);
  const MAX_SEC = 45;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    const id = Math.floor(rng() * run.state.cards.length);
    tel.act(() => run.showCard(id));
    if (rng() < 0.25) tel.act(() => run.usePeek());
    tel.tick(1 / 60);
  }
  let guard = 2000;
  while (run.state.phase === 'playing' && guard-- > 0) tel.tick(0.05);
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(LEVEL_INDEX, { mode: 'timed', seed });
  const tel = makeTracker(run, 'noinput', seed);
  skipMemorize(run, tel);
  let guard = 4000;
  while (run.state.phase === 'playing' && guard-- > 0) tel.tick(0.05);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'liankan-tile-link',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} events=${r.uniqueEvents}`,
  );
}
