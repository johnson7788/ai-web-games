// MAHJONG ROOM · 自对弈（无头 Node，直接 import sim）
// greedy / random / noinput 三策略 → tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, bestDiscard, mulberry32 } from '../src/game/sim.js';
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
        if ((e.type === 'roundwin' || e.type === 'win') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    level: run.state.round,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
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

// ---------------- greedy：最优出牌 + 能胡就胡 + 能碰杠就碰杠 + 能量满就幸运换牌 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 400000) {
    guard += 1;
    if (run.state.decider !== 0) { tel.tick(1 / 60); continue; }

    const opts = run.state.options;
    const has = (k) => opts.find((o) => o.kind === k);
    if (run.state.stage === 'discard') {
      if (has('hu')) { tel.act(() => run.act({ kind: 'hu' })); continue; }
      if (has('angang')) { const a = has('angang'); tel.act(() => run.act({ kind: 'angang', t: a.t })); continue; }
      if (run.state.energy >= GAME.ENERGY_MAX) { const l = run.lucky(); if (l.ok) { tel.actions += 1; if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime; tel.tick(1 / 60); continue; } }
      const t = bestDiscard(run.state.hands[0]);
      if (t != null) { tel.act(() => run.act({ kind: 'discard', t })); continue; }
      tel.tick(1 / 60);
    } else {
      if (has('hu')) { tel.act(() => run.act({ kind: 'hu' })); continue; }
      if (has('peng')) { tel.act(() => run.act({ kind: 'peng' })); continue; }
      if (has('minggang')) { tel.act(() => run.act({ kind: 'minggang' })); continue; }
      tel.act(() => run.act({ kind: 'pass' }));
    }
  }
  return finish(tel, run);
}

// ---------------- random：随机挑一个合法动作 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const CAP = 600;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    if (run.state.decider === 0 && run.state.options.length) {
      const opts = run.state.options;
      const pick = opts[Math.floor(rng() * opts.length)];
      if (pick.kind === 'discard') tel.act(() => run.act({ kind: 'discard', t: pick.t }));
      else if (pick.kind === 'angang') tel.act(() => run.act({ kind: 'angang', t: pick.t }));
      else tel.act(() => run.act({ kind: pick.kind }));
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动出牌与死时间基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 600) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'mahjong-room-en',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} ` +
    `levels=${r.levelsReached} completed=${r.completed}`,
  );
}
