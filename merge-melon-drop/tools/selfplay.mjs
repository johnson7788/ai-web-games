// MERGE MELON DROP · 自对弈（无头，直接 import sim，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，跑完写 tools/fun/autoplay.json。
// schema 见 skills/webgame-playbook/references/playtest-protocol.md §3。
// 运行：node tools/selfplay.mjs
import { createRun, STEP } from '../src/game/sim.js';
import { WORLD, ROCK, MAX_TIER } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const COL_SPACING = 40;

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
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
        if (e.type === 'merge' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'gameover') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(STEP);
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
  const reachedNova = run.state.maxTier >= MAX_TIER;
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.levelsReached,
    completed: reachedNova || run.state.phase === 'over',
  };
}

// 计算某列顶部（空列 = FLOOR_Y）；顶部越靠下说明列越空
function columnTop(run, x) {
  let top = WORLD.FLOOR_Y;
  for (const b of run.state.bodies) {
    if (Math.abs(b.x - x) <= COL_SPACING / 2) top = Math.min(top, b.y - b.r);
  }
  return top;
}

function columns() {
  const list = [];
  for (let x = WORLD.WALL_L + 30; x <= WORLD.WALL_R - 30; x += COL_SPACING) list.push(x);
  return list;
}

// 找同阶且最暴露（顶部最高）的水果
function findSameTier(run, tier) {
  let best = null;
  let bestTop = Infinity;
  for (const b of run.state.bodies) {
    if (b.kind !== 'fruit' || b.tier !== tier) continue;
    const top = b.y - b.r;
    if (top < bestTop) { bestTop = top; best = b; }
  }
  return best;
}

function emptiestX(run) {
  const cols = columns();
  let bx = cols[0];
  let bestTop = -Infinity;
  for (const x of cols) {
    const t = columnTop(run, x);
    if (t > bestTop) { bestTop = t; bx = x; }
  }
  return bx;
}

// ---------------- greedy：优先同阶合成，否则填最空列 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const CAP = 150;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    const tier = run.state.heldTier;
    let x;
    if (tier === -1) {
      x = emptiestX(run); // 岩石填最空处，少堵
    } else {
      const same = findSameTier(run, tier);
      x = same ? same.x : emptiestX(run);
    }
    tel.act(() => run.setAim(x));
    tel.act(() => run.drop());
    for (let f = 0; f < 100 && run.state.phase === 'playing'; f += 1) tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- random：随机落点/节奏，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = (() => {
    let s = (seed * 7919 + 13) >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const CAP = 150;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    const L = WORLD.WALL_L + 30;
    const R = WORLD.WALL_R - 30;
    const x = L + rng() * (R - L);
    tel.act(() => run.setAim(x));
    tel.act(() => run.drop());
    const settle = 40 + Math.floor(rng() * 90);
    for (let f = 0; f < settle && run.state.phase === 'playing'; f += 1) tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const CAP = 10;
  while (run.state.phase === 'playing' && tel.simTime < CAP) tel.tick(STEP);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'merge-melon-drop',
  genre: 'puzzle',
  source: 'bot',
  version: 'v1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} ` +
    `levels=${r.levelsReached} maxGap=${r.maxEventGapSec}s completed=${r.completed}`,
  );
}
